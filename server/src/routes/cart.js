import { Router } from 'express';
import { db } from '../db.js';
import { badRequest, conflict, forbidden, notFound } from '../lib/errors.js';
import { requireAuth } from '../lib/auth.js';
import { IMAGE_SQL, intParam } from '../lib/serialize.js';
import { imageUrl, thumbPath } from '../lib/images.js';

const router = Router();
router.use('/cart', requireAuth);

export function getCart(userId) {
  const rows = db.prepare(
    `SELECT c.product_id, c.quantity, c.price_when_added, p.title, p.price_amd, p.stock, p.is_published, p.seller_id, u.store_name, ${IMAGE_SQL} AS image
     FROM cart_items c JOIN products p ON p.id = c.product_id JOIN users u ON u.id = p.seller_id
     WHERE c.user_id = ? ORDER BY u.id, p.title`,
  ).all(userId);

  const groups = new Map();
  let total = 0, itemCount = 0, hasIssues = false;
  for (const r of rows) {
    const item = {
      productId: r.product_id, title: r.title, thumb: r.image ? imageUrl(thumbPath(r.image)) : null,
      quantity: r.quantity, priceAmd: r.price_amd, priceWhenAdded: r.price_when_added, stock: r.stock,
      unavailable: !r.is_published,
      soldOut: !!r.is_published && r.stock === 0,
      exceedsStock: !!r.is_published && r.stock > 0 && r.quantity > r.stock,
      priceChanged: r.price_amd !== r.price_when_added,
    };
    item.hasIssue = item.unavailable || item.soldOut || item.exceedsStock || item.priceChanged;
    hasIssues ||= item.hasIssue;
    if (!groups.has(r.seller_id)) groups.set(r.seller_id, { sellerId: r.seller_id, storeName: r.store_name, items: [], subtotalAmd: 0 });
    const g = groups.get(r.seller_id);
    g.items.push(item);
    g.subtotalAmd += r.price_amd * r.quantity;
    total += r.price_amd * r.quantity;
    itemCount += r.quantity;
  }
  return { groups: [...groups.values()], totalAmd: total, itemCount, hasIssues };
}

router.get('/cart', (req, res) => res.json({ cart: getCart(req.user.id) }));

router.put('/cart/items/:productId', (req, res) => {
  const productId = intParam(req.params.productId);
  const qty = req.body?.quantity;
  if (!Number.isInteger(qty) || qty < 1 || qty > 999) throw badRequest('Quantity must be a whole number of 1 or more.', { quantity: 'Enter a whole number of 1 or more.' });
  const p = productId && db.prepare('SELECT id, title, price_amd, stock, seller_id, is_published FROM products WHERE id = ?').get(productId);
  if (!p || !p.is_published) throw notFound('This product is not available.');
  if (p.seller_id === req.user.id) throw forbidden('You cannot buy your own product.');

  const existing = db.prepare('SELECT quantity FROM cart_items WHERE user_id = ? AND product_id = ?').get(req.user.id, p.id);
  const newQty = req.body.add && existing ? existing.quantity + qty : qty;
  if (p.stock === 0) throw conflict('OUT_OF_STOCK', `"${p.title}" is out of stock.`, { available: 0 });
  if (newQty > p.stock) {
    throw conflict('INSUFFICIENT_STOCK', existing && req.body.add
      ? `Only ${p.stock} left, and ${existing.quantity} already in your cart.`
      : `Only ${p.stock} left in stock.`, { available: p.stock });
  }
  db.prepare(
    `INSERT INTO cart_items (user_id, product_id, quantity, price_when_added) VALUES (?, ?, ?, ?)
     ON CONFLICT (user_id, product_id) DO UPDATE SET quantity = excluded.quantity,
       price_when_added = CASE WHEN ? THEN excluded.price_when_added ELSE cart_items.price_when_added END`,
  ).run(req.user.id, p.id, newQty, p.price_amd, req.body.acceptPrice ? 1 : 0);
  res.json({ cart: getCart(req.user.id) });
});

router.delete('/cart/items/:productId', (req, res) => {
  const productId = intParam(req.params.productId);
  db.prepare('DELETE FROM cart_items WHERE user_id = ? AND product_id = ?').run(req.user.id, productId ?? -1);
  res.json({ cart: getCart(req.user.id) });
});

export default router;
