import { Router } from 'express';
import { db, now } from '../db.js';
import { badRequest, clean, conflict, forbidden, notFound } from '../lib/errors.js';
import { requireAuth } from '../lib/auth.js';
import { intParam } from '../lib/serialize.js';

const router = Router();

const delivered = db.prepare(
  `SELECT 1 FROM order_items oi JOIN seller_orders so ON so.id = oi.seller_order_id JOIN orders o ON o.id = so.order_id
   WHERE oi.product_id = ? AND o.buyer_id = ? AND so.status = 'delivered' LIMIT 1`,
);

const addReview = db.transaction((productId, buyerId, rating, body) => {
  db.prepare('INSERT INTO reviews (product_id, buyer_id, rating, body, created_at) VALUES (?, ?, ?, ?, ?)').run(productId, buyerId, rating, body, now());
  db.prepare(
    `UPDATE products SET rating_avg = (SELECT ROUND(AVG(rating), 2) FROM reviews WHERE product_id = @id),
       rating_count = (SELECT COUNT(*) FROM reviews WHERE product_id = @id) WHERE id = @id`,
  ).run({ id: productId });
  return db.prepare('SELECT rating_avg, rating_count FROM products WHERE id = ?').get(productId);
}).immediate;

router.post('/products/:id/reviews', requireAuth, (req, res) => {
  const productId = intParam(req.params.id);
  if (!productId || !db.prepare('SELECT 1 FROM products WHERE id = ?').get(productId)) throw notFound('Product not found.');
  const rating = req.body?.rating;
  const body = clean(req.body?.body);
  const fields = {};
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) fields.rating = 'Choose 1 to 5 stars.';
  if (body.length > 1000) fields.body = 'A review can be up to 1000 characters.';
  if (Object.keys(fields).length) throw badRequest('Check the highlighted fields.', fields);
  if (!delivered.get(productId, req.user.id)) throw forbidden('You can review a product only after it was delivered to you.');
  try {
    const p = addReview(productId, req.user.id, rating, body);
    res.status(201).json({ product: { ratingAvg: p.rating_avg, ratingCount: p.rating_count } });
  } catch (err) {
    if (String(err.code).startsWith('SQLITE_CONSTRAINT')) throw conflict('ALREADY_REVIEWED', 'You have already reviewed this product.');
    throw err;
  }
});

export default router;
