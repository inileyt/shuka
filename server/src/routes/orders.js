import { Router } from 'express';
import { db, now } from '../db.js';
import { badRequest, clean, conflict, forbidden, notFound } from '../lib/errors.js';
import { requireAuth } from '../lib/auth.js';
import { REGIONS, intParam } from '../lib/serialize.js';
import { moveSellerOrder } from '../lib/orders.js';
import { PHONE_RE } from './auth.js';

const router = Router();
router.use('/orders', requireAuth);

const findByKey = db.prepare('SELECT id, buyer_id FROM orders WHERE request_key = ?');
const cartLines = db.prepare(
  `SELECT c.product_id, c.quantity, c.price_when_added, p.title, p.price_amd, p.is_published, p.seller_id
   FROM cart_items c JOIN products p ON p.id = c.product_id WHERE c.user_id = ? ORDER BY c.product_id`,
);
// Never read-then-write: the check and the change are one statement.
const takeStock = db.prepare('UPDATE products SET stock = stock - ?, updated_at = ? WHERE id = ? AND stock >= ?');
const insOrder = db.prepare(
  `INSERT INTO orders (buyer_id, recipient, phone, region, city, street, apartment, note, total_amd, request_key, created_at)
   VALUES (@buyer_id, @recipient, @phone, @region, @city, @street, @apartment, @note, @total_amd, @request_key, @created_at)`,
);
const insSellerOrder = db.prepare('INSERT INTO seller_orders (order_id, seller_id, status, subtotal_amd, updated_at) VALUES (?, ?, ?, ?, ?)');
const insItem = db.prepare('INSERT INTO order_items (seller_order_id, product_id, title, unit_price_amd, quantity) VALUES (?, ?, ?, ?, ?)');
const insHistory = db.prepare('INSERT INTO status_history (seller_order_id, from_status, to_status, changed_by, created_at) VALUES (?, NULL, ?, ?, ?)');
const clearCart = db.prepare('DELETE FROM cart_items WHERE user_id = ?');
const amd = (n) => `${n.toLocaleString('en-US')} AMD`;

// The whole checkout is ONE immediate transaction. If any line fails, everything (stock included) rolls back.
const checkout = db.transaction((userId, requestKey, addr) => {
  const existing = findByKey.get(requestKey);
  if (existing) {
    if (existing.buyer_id !== userId) throw conflict('REQUEST_KEY_USED', 'This request key belongs to another order.');
    return { orderId: existing.id, duplicate: true };
  }
  const lines = cartLines.all(userId);
  if (!lines.length) throw badRequest('Your cart is empty.');

  for (const l of lines) {
    if (!l.is_published) throw conflict('UNAVAILABLE', `"${l.title}" is no longer available. Remove it from your cart.`, { productId: l.product_id, title: l.title });
    if (l.seller_id === userId) throw forbidden('You cannot buy your own product.');
    if (l.price_amd !== l.price_when_added) {
      throw conflict('PRICE_CHANGED', `The price of "${l.title}" changed from ${amd(l.price_when_added)} to ${amd(l.price_amd)}. Review your cart and confirm the new price.`,
        { productId: l.product_id, title: l.title, oldPriceAmd: l.price_when_added, newPriceAmd: l.price_amd });
    }
  }
  const ts = now();
  for (const l of lines) {
    const r = takeStock.run(l.quantity, ts, l.product_id, l.quantity);
    if (r.changes !== 1) throw conflict('OUT_OF_STOCK', `Not enough stock left for "${l.title}".`, { productId: l.product_id, title: l.title });
  }

  const total = lines.reduce((s, l) => s + l.price_amd * l.quantity, 0);
  const orderId = insOrder.run({ buyer_id: userId, ...addr, total_amd: total, request_key: requestKey, created_at: ts }).lastInsertRowid;

  const bySeller = new Map();
  for (const l of lines) (bySeller.get(l.seller_id) ?? bySeller.set(l.seller_id, []).get(l.seller_id)).push(l);
  for (const [sellerId, items] of bySeller) {
    const subtotal = items.reduce((s, l) => s + l.price_amd * l.quantity, 0);
    const soId = insSellerOrder.run(orderId, sellerId, 'placed', subtotal, ts).lastInsertRowid;
    for (const l of items) insItem.run(soId, l.product_id, l.title, l.price_amd, l.quantity); // title and price are copied
    insHistory.run(soId, 'placed', userId, ts);
  }
  clearCart.run(userId);
  return { orderId, duplicate: false };
}).immediate;

function readAddress(body) {
  const b = body ?? {};
  const f = {
    recipient: clean(b.recipient), phone: clean(b.phone), region: clean(b.region), city: clean(b.city),
    street: clean(b.street), building: clean(b.building), apartment: clean(b.apartment), note: clean(b.note),
  };
  const fields = {};
  if (f.recipient.length < 2 || f.recipient.length > 100) fields.recipient = 'Enter the recipient name.';
  if (!PHONE_RE.test(f.phone)) fields.phone = 'Enter a valid phone number, for example +374 91 123456.';
  if (!REGIONS.includes(f.region)) fields.region = 'Choose Yerevan or a marz.';
  if (!f.city || f.city.length > 100) fields.city = 'Enter the city or village.';
  if (!f.street || f.street.length > 120) fields.street = 'Enter the street.';
  if (!f.building || f.building.length > 30) fields.building = 'Enter the building number.';
  if (f.apartment.length > 30) fields.apartment = 'Too long.';
  if (f.note.length > 500) fields.note = 'The note can be up to 500 characters.';
  const key = typeof b.requestKey === 'string' ? b.requestKey : '';
  if (key.length < 8 || key.length > 100) fields.requestKey = 'Missing request key.';
  if (Object.keys(fields).length) throw badRequest('Check the highlighted fields.', fields);
  return {
    key,
    addr: { recipient: f.recipient, phone: f.phone, region: f.region, city: f.city, street: `${f.street}, ${f.building}`, apartment: f.apartment, note: f.note },
  };
}

export function buyerOrder(orderId, buyerId) {
  const o = db.prepare('SELECT * FROM orders WHERE id = ? AND buyer_id = ?').get(orderId, buyerId);
  if (!o) return null;
  const sos = db.prepare(
    `SELECT so.id, so.seller_id, so.status, so.subtotal_amd, so.updated_at, u.store_name
     FROM seller_orders so JOIN users u ON u.id = so.seller_id WHERE so.order_id = ? ORDER BY so.id`,
  ).all(o.id);
  const sellerOrders = sos.map((so) => ({
    id: so.id, status: so.status, subtotalAmd: so.subtotal_amd, updatedAt: so.updated_at,
    seller: { id: so.seller_id, storeName: so.store_name },
    canCancel: so.status === 'placed' || so.status === 'confirmed',
    items: db.prepare(
      `SELECT oi.product_id, oi.title, oi.unit_price_amd, oi.quantity, (r.id IS NOT NULL) AS reviewed
       FROM order_items oi LEFT JOIN reviews r ON r.product_id = oi.product_id AND r.buyer_id = ?
       WHERE oi.seller_order_id = ? ORDER BY oi.id`,
    ).all(buyerId, so.id).map((i) => ({
      productId: i.product_id, title: i.title, unitPriceAmd: i.unit_price_amd, quantity: i.quantity,
      reviewed: !!i.reviewed, canReview: so.status === 'delivered' && !i.reviewed,
    })),
    history: db.prepare('SELECT from_status, to_status, created_at FROM status_history WHERE seller_order_id = ? ORDER BY id').all(so.id)
      .map((h) => ({ from: h.from_status, to: h.to_status, at: h.created_at })),
  }));
  return {
    id: o.id, createdAt: o.created_at, totalAmd: o.total_amd, paymentMethod: 'Cash on delivery',
    recipient: o.recipient, phone: o.phone, region: o.region, city: o.city, street: o.street, apartment: o.apartment, note: o.note,
    sellerOrders,
  };
}

router.post('/orders', (req, res) => {
  const { key, addr } = readAddress(req.body);
  let result;
  try {
    result = checkout(req.user.id, key, addr);
  } catch (err) {
    // A concurrent twin slipped past the check: the UNIQUE constraint caught it. Return the existing order.
    if (String(err.code).startsWith('SQLITE_CONSTRAINT') && /request_key/.test(err.message)) {
      const existing = findByKey.get(key);
      if (existing?.buyer_id === req.user.id) result = { orderId: existing.id, duplicate: true };
    }
    if (!result) throw err;
  }
  res.status(result.duplicate ? 200 : 201).json({ order: buyerOrder(result.orderId, req.user.id), duplicate: result.duplicate });
});

router.get('/orders', (req, res) => {
  const orders = db.prepare('SELECT id, total_amd, created_at FROM orders WHERE buyer_id = ? ORDER BY id DESC LIMIT 200').all(req.user.id);
  const sos = db.prepare(
    `SELECT so.order_id, so.id, so.status, u.store_name FROM seller_orders so JOIN users u ON u.id = so.seller_id
     JOIN orders o ON o.id = so.order_id WHERE o.buyer_id = ? ORDER BY so.id`,
  ).all(req.user.id);
  res.json({
    orders: orders.map((o) => ({
      id: o.id, totalAmd: o.total_amd, createdAt: o.created_at,
      sellerOrders: sos.filter((s) => s.order_id === o.id).map((s) => ({ id: s.id, status: s.status, storeName: s.store_name })),
    })),
  });
});

router.get('/orders/:id', (req, res) => {
  const id = intParam(req.params.id);
  const order = id && buyerOrder(id, req.user.id); // scoped to the signed-in buyer
  if (!order) throw notFound('Order not found.');
  res.json({ order });
});

router.post('/orders/:id/sellers/:sellerOrderId/cancel', (req, res) => {
  const orderId = intParam(req.params.id);
  const soId = intParam(req.params.sellerOrderId);
  const owned = orderId && soId && db.prepare(
    'SELECT so.id FROM seller_orders so JOIN orders o ON o.id = so.order_id WHERE so.id = ? AND o.id = ? AND o.buyer_id = ?',
  ).get(soId, orderId, req.user.id);
  if (!owned) throw notFound('Order not found.');
  moveSellerOrder(soId, 'cancelled', req.user.id, 'buyer');
  res.json({ order: buyerOrder(orderId, req.user.id) });
});

export default router;
