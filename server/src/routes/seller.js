import { Router } from 'express';
import { db, now } from '../db.js';
import { badRequest, clean, conflict, notFound } from '../lib/errors.js';
import { requireAuth, requireSeller } from '../lib/auth.js';
import { IMAGE_SQL, imageOut, intParam, productCard } from '../lib/serialize.js';
import { processImage, removeImageFiles, upload } from '../lib/images.js';
import { ALLOWED_MOVES, moveSellerOrder } from '../lib/orders.js';
import { config } from '../config.js';
import { PHONE_RE } from './auth.js';

const router = Router();
const STATUSES = ['placed', 'confirmed', 'shipped', 'delivered', 'cancelled'];

router.post('/seller/activate', requireAuth, (req, res) => {
  if (req.user.store_name) throw conflict('ALREADY_SELLER', 'You are already a seller.');
  const storeName = clean(req.body?.storeName);
  const phone = clean(req.body?.phone);
  const fields = {};
  if (storeName.length < 2 || storeName.length > 60) fields.storeName = 'Enter a store name (2 to 60 characters).';
  if (!PHONE_RE.test(phone)) fields.phone = 'Enter a valid phone number.';
  if (Object.keys(fields).length) throw badRequest('Check the highlighted fields.', fields);
  try {
    db.prepare('UPDATE users SET store_name = ?, phone = ? WHERE id = ?').run(storeName, phone, req.user.id);
  } catch (err) {
    if (String(err.code).startsWith('SQLITE_CONSTRAINT')) throw conflict('STORE_TAKEN', 'This store name is taken.', { fields: { storeName: 'This store name is taken.' } });
    throw err;
  }
  res.status(201).json({ storeName });
});

router.use('/seller', requireSeller);

router.get('/seller/overview', (req, res) => {
  const counts = Object.fromEntries(STATUSES.map((s) => [s, 0]));
  for (const r of db.prepare('SELECT status, COUNT(*) AS n FROM seller_orders WHERE seller_id = ? GROUP BY status').all(req.user.id)) counts[r.status] = r.n;
  const since = new Date(Date.now() - 30 * 86400_000).toISOString();
  const rev = db.prepare(
    `SELECT COALESCE(SUM(CASE WHEN updated_at >= ? THEN subtotal_amd END), 0) AS last30, COALESCE(SUM(subtotal_amd), 0) AS total
     FROM seller_orders WHERE seller_id = ? AND status = 'delivered'`,
  ).get(since, req.user.id);
  res.json({
    toConfirm: counts.placed, toShip: counts.confirmed, ordersByStatus: counts,
    revenueLast30DaysAmd: rev.last30, revenueTotalAmd: rev.total,
    productCount: db.prepare('SELECT COUNT(*) AS n FROM products WHERE seller_id = ?').get(req.user.id).n,
  });
});

/* ---------- products ---------- */

function readProduct(body, { partial }) {
  const b = body ?? {};
  const out = {};
  const fields = {};
  const has = (k) => !partial || b[k] !== undefined;
  if (has('title')) {
    out.title = clean(b.title);
    if (out.title.length < 3 || out.title.length > 120) fields.title = 'Enter a title (3 to 120 characters).';
  }
  if (has('description')) {
    out.description = clean(b.description);
    if (out.description.length < 10 || out.description.length > 5000) fields.description = 'Describe the product (10 to 5000 characters).';
  }
  if (has('price')) {
    const price = Number(b.price);
    if (b.price === '' || !Number.isInteger(price) || price < 1 || price > 100_000_000) fields.price = 'Enter a price in AMD, a whole number above 0.';
    else out.price_amd = price;
  }
  if (has('stock')) {
    const stock = Number(b.stock);
    if (b.stock === '' || b.stock === null || !Number.isInteger(stock) || stock < 0 || stock > 100_000) fields.stock = 'Enter the stock, a whole number of 0 or more.';
    else out.stock = stock;
  }
  if (has('categoryId')) {
    const id = intParam(b.categoryId);
    if (!id || !db.prepare('SELECT 1 FROM categories WHERE id = ?').get(id)) fields.categoryId = 'Choose a category.';
    else out.category_id = id;
  }
  if (b.isPublished !== undefined) out.is_published = b.isPublished === true || b.isPublished === 'true' || b.isPublished === '1' || b.isPublished === 1 ? 1 : 0;
  return { out, fields };
}

const ownProduct = (req) => {
  const id = intParam(req.params.id);
  const p = id && db.prepare('SELECT * FROM products WHERE id = ? AND seller_id = ?').get(id, req.user.id); // scoped to the seller
  if (!p) throw notFound('Product not found.');
  return p;
};

const productFull = (id) => {
  const p = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
  return {
    id: p.id, title: p.title, description: p.description, priceAmd: p.price_amd, stock: p.stock, categoryId: p.category_id,
    isPublished: !!p.is_published, ratingAvg: p.rating_avg, ratingCount: p.rating_count,
    images: db.prepare('SELECT id, file_path, position FROM product_images WHERE product_id = ? ORDER BY position').all(id).map(imageOut),
  };
};

// Renumbers positions 0..n-1 in two passes so UNIQUE (product_id, position) is never violated.
function renumber(orderedIds) {
  const set = db.prepare('UPDATE product_images SET position = ? WHERE id = ?');
  orderedIds.forEach((id, i) => set.run(-(i + 1), id));
  orderedIds.forEach((id, i) => set.run(i, id));
}

router.get('/seller/products', (req, res) => {
  const rows = db.prepare(
    `SELECT p.id, p.title, p.price_amd, p.stock, p.is_published, p.rating_avg, p.rating_count, u.store_name, ${IMAGE_SQL} AS image,
       COALESCE((SELECT SUM(oi.quantity) FROM order_items oi JOIN seller_orders so ON so.id = oi.seller_order_id
                 WHERE oi.product_id = p.id AND so.status != 'cancelled'), 0) AS units_sold
     FROM products p JOIN users u ON u.id = p.seller_id WHERE p.seller_id = ? ORDER BY p.created_at DESC, p.id DESC`,
  ).all(req.user.id);
  res.json({ products: rows.map((r) => ({ ...productCard(r), isPublished: !!r.is_published, unitsSold: r.units_sold })) });
});

router.get('/seller/products/:id', (req, res) => res.json({ product: productFull(ownProduct(req).id) }));

router.post('/seller/products', upload.array('images', config.maxImagesPerProduct), async (req, res) => {
  const { out, fields } = readProduct(req.body, { partial: false });
  const files = req.files ?? [];
  if (files.length < 1) fields.images = 'Add at least one image.';
  if (Object.keys(fields).length) throw badRequest('Check the highlighted fields.', fields);

  const saved = [];
  try {
    for (const f of files) saved.push(await processImage(f)); // files are written before the transaction starts
    const id = db.transaction(() => {
      const ts = now();
      const pid = db.prepare(
        `INSERT INTO products (seller_id, category_id, title, description, price_amd, stock, is_published, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(req.user.id, out.category_id, out.title, out.description, out.price_amd, out.stock, out.is_published ?? 1, ts, ts).lastInsertRowid;
      saved.forEach((p, i) => db.prepare('INSERT INTO product_images (product_id, file_path, position) VALUES (?, ?, ?)').run(pid, p, i));
      return pid;
    })();
    res.status(201).json({ product: productFull(id) });
  } catch (err) {
    saved.forEach(removeImageFiles);
    throw err;
  }
});

router.patch('/seller/products/:id', (req, res) => {
  const p = ownProduct(req);
  const { out, fields } = readProduct(req.body, { partial: true });
  const imgs = db.prepare('SELECT id FROM product_images WHERE product_id = ? ORDER BY position').all(p.id).map((i) => i.id);
  if (out.is_published === 1 && imgs.length === 0) fields.images = 'Add at least one image before publishing.';
  const mainId = req.body?.mainImageId === undefined ? null : intParam(req.body.mainImageId);
  if (req.body?.mainImageId !== undefined && !imgs.includes(mainId)) fields.mainImageId = 'Unknown image.';
  if (Object.keys(fields).length) throw badRequest('Check the highlighted fields.', fields);

  db.transaction(() => {
    const keys = Object.keys(out);
    if (keys.length) {
      db.prepare(`UPDATE products SET ${keys.map((k) => `${k} = @${k}`).join(', ')}, updated_at = @updated_at WHERE id = @id`)
        .run({ ...out, updated_at: now(), id: p.id });
    }
    if (mainId) renumber([mainId, ...imgs.filter((i) => i !== mainId)]);
  })();
  res.json({ product: productFull(p.id) });
});

router.post('/seller/products/:id/images', upload.array('images', config.maxImagesPerProduct), async (req, res) => {
  const p = ownProduct(req);
  const files = req.files ?? [];
  if (!files.length) throw badRequest('Choose at least one image.', { images: 'Choose at least one image.' });
  const have = db.prepare('SELECT COUNT(*) AS n FROM product_images WHERE product_id = ?').get(p.id).n;
  if (have + files.length > config.maxImagesPerProduct) {
    throw badRequest(`A product can have up to ${config.maxImagesPerProduct} images. It has ${have}.`, { images: `Up to ${config.maxImagesPerProduct} images.` });
  }
  const saved = [];
  try {
    for (const f of files) saved.push(await processImage(f));
    db.transaction(() => {
      const next = db.prepare('SELECT COALESCE(MAX(position), -1) + 1 AS n FROM product_images WHERE product_id = ?').get(p.id).n;
      saved.forEach((path, i) => db.prepare('INSERT INTO product_images (product_id, file_path, position) VALUES (?, ?, ?)').run(p.id, path, next + i));
      db.prepare('UPDATE products SET updated_at = ? WHERE id = ?').run(now(), p.id);
    })();
  } catch (err) {
    saved.forEach(removeImageFiles);
    throw err;
  }
  res.status(201).json({ product: productFull(p.id) });
});

router.delete('/seller/products/:id/images/:imageId', (req, res) => {
  const p = ownProduct(req);
  const imageId = intParam(req.params.imageId);
  const img = imageId && db.prepare('SELECT id, file_path FROM product_images WHERE id = ? AND product_id = ?').get(imageId, p.id);
  if (!img) throw notFound('Image not found.');
  const all = db.prepare('SELECT id FROM product_images WHERE product_id = ? ORDER BY position').all(p.id).map((i) => i.id);
  if (all.length === 1 && p.is_published) throw conflict('LAST_IMAGE', 'A published product needs at least one image. Unpublish it first.');
  db.transaction(() => {
    db.prepare('DELETE FROM product_images WHERE id = ?').run(img.id);
    renumber(all.filter((i) => i !== img.id));
  })();
  removeImageFiles(img.file_path);
  res.json({ product: productFull(p.id) });
});

/* ---------- incoming orders ---------- */

function sellerOrderDetail(soId, sellerId) {
  const so = db.prepare(
    `SELECT so.id, so.order_id, so.status, so.subtotal_amd, so.updated_at, o.created_at, o.recipient, o.phone, o.region, o.city, o.street, o.apartment, o.note
     FROM seller_orders so JOIN orders o ON o.id = so.order_id WHERE so.id = ? AND so.seller_id = ?`, // scoped to the seller
  ).get(soId, sellerId);
  if (!so) return null;
  return {
    id: so.id, orderId: so.order_id, status: so.status, createdAt: so.created_at, updatedAt: so.updated_at,
    cashToCollectAmd: so.status === 'cancelled' ? 0 : so.subtotal_amd, subtotalAmd: so.subtotal_amd,
    recipient: so.recipient, phone: so.phone, region: so.region, city: so.city, street: so.street, apartment: so.apartment, note: so.note,
    items: db.prepare('SELECT product_id, title, unit_price_amd, quantity FROM order_items WHERE seller_order_id = ? ORDER BY id').all(so.id)
      .map((i) => ({ productId: i.product_id, title: i.title, unitPriceAmd: i.unit_price_amd, quantity: i.quantity })),
    history: db.prepare('SELECT from_status, to_status, created_at FROM status_history WHERE seller_order_id = ? ORDER BY id').all(so.id)
      .map((h) => ({ from: h.from_status, to: h.to_status, at: h.created_at })),
    allowedMoves: ALLOWED_MOVES[so.status],
  };
}

router.get('/seller/orders', (req, res) => {
  const status = req.query.status ? String(req.query.status) : null;
  if (status && !STATUSES.includes(status)) throw badRequest('Unknown status.', { status: 'Unknown status.' });
  const counts = Object.fromEntries(STATUSES.map((s) => [s, 0]));
  for (const r of db.prepare('SELECT status, COUNT(*) AS n FROM seller_orders WHERE seller_id = ? GROUP BY status').all(req.user.id)) counts[r.status] = r.n;
  const rows = db.prepare(
    `SELECT so.id, so.order_id, so.status, so.subtotal_amd, o.created_at, o.recipient, o.city,
       (SELECT SUM(quantity) FROM order_items WHERE seller_order_id = so.id) AS units
     FROM seller_orders so JOIN orders o ON o.id = so.order_id
     WHERE so.seller_id = ? AND (? IS NULL OR so.status = ?) ORDER BY o.created_at DESC, so.id DESC LIMIT 200`,
  ).all(req.user.id, status, status);
  res.json({
    counts,
    orders: rows.map((r) => ({ id: r.id, orderId: r.order_id, status: r.status, subtotalAmd: r.subtotal_amd, createdAt: r.created_at, recipient: r.recipient, city: r.city, units: r.units })),
  });
});

router.get('/seller/orders/:id', (req, res) => {
  const id = intParam(req.params.id);
  const order = id && sellerOrderDetail(id, req.user.id);
  if (!order) throw notFound('Order not found.');
  res.json({ order });
});

router.post('/seller/orders/:id/status', (req, res) => {
  const id = intParam(req.params.id);
  if (!id || !sellerOrderDetail(id, req.user.id)) throw notFound('Order not found.');
  const to = req.body?.to;
  if (!STATUSES.includes(to)) throw badRequest('Unknown status.', { to: 'Unknown status.' });
  moveSellerOrder(id, to, req.user.id, 'seller');
  res.json({ order: sellerOrderDetail(id, req.user.id) });
});

export default router;
