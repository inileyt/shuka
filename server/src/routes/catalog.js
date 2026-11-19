import { Router } from 'express';
import { db } from '../db.js';
import { badRequest, notFound } from '../lib/errors.js';
import { IMAGE_SQL, imageOut, intParam, productCard } from '../lib/serialize.js';
import { config } from '../config.js';
import { imageUrl, thumbPath } from '../lib/images.js';

const router = Router();

const SORTS = {
  newest: 'p.created_at DESC, p.id DESC',
  price_asc: 'p.price_amd ASC, p.id DESC',
  price_desc: 'p.price_amd DESC, p.id DESC',
  rating: 'p.rating_avg DESC, p.rating_count DESC, p.id DESC',
};

router.get('/categories', (_req, res) => {
  res.json({ categories: db.prepare('SELECT id, name, slug FROM categories ORDER BY name').all() });
});

// Home page: every category with its picture, product count and a few products.
router.get('/home', (_req, res) => {
  const cats = db.prepare(
    `SELECT c.id, c.name, c.slug, COUNT(p.id) AS n FROM categories c
     LEFT JOIN products p ON p.category_id = c.id AND p.is_published = 1 GROUP BY c.id ORDER BY c.name`,
  ).all();
  const top = db.prepare(
    `SELECT p.id, p.title, p.price_amd, p.stock, p.rating_avg, p.rating_count, u.store_name, ${IMAGE_SQL} AS image
     FROM products p JOIN users u ON u.id = p.seller_id
     WHERE p.category_id = ? AND p.is_published = 1 ORDER BY p.rating_count DESC, p.created_at DESC, p.id DESC LIMIT 4`,
  );
  const tile = db.prepare(
    `SELECT ${IMAGE_SQL} AS image FROM products p WHERE p.category_id = ? AND p.is_published = 1 ORDER BY p.id ASC LIMIT 1`,
  );
  const sections = cats.filter((c) => c.n > 0).map((c) => {
    const items = top.all(c.id).map(productCard);
    return { id: c.id, name: c.name, slug: c.slug, productCount: c.n, image: (() => { const i = tile.get(c.id)?.image; return i ? imageUrl(thumbPath(i)) : null; })(), items };
  });
  res.json({ categories: sections });
});

router.get('/products', (req, res) => {
  const { q = '', category = '', sort = 'newest' } = req.query;
  const fields = {};
  const minPrice = req.query.minPrice ? intParam(req.query.minPrice) : null;
  const maxPrice = req.query.maxPrice ? intParam(req.query.maxPrice) : null;
  const page = req.query.page ? intParam(req.query.page) : 1;
  if (req.query.minPrice && minPrice === null) fields.minPrice = 'Enter a whole number.';
  if (req.query.maxPrice && maxPrice === null) fields.maxPrice = 'Enter a whole number.';
  if (minPrice !== null && maxPrice !== null && minPrice > maxPrice) fields.minPrice = 'Minimum price is above the maximum.';
  if (!page || page < 1) fields.page = 'Page must be 1 or more.';
  if (!SORTS[sort]) fields.sort = 'Unknown sort order.';
  if (Object.keys(fields).length) throw badRequest('Invalid search options.', fields);

  const where = ['p.is_published = 1'];
  const params = [];
  const term = String(q).trim().slice(0, 100);
  if (term) {
    const like = `%${term.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
    where.push("(p.title LIKE ? ESCAPE '\\' OR p.description LIKE ? ESCAPE '\\')");
    params.push(like, like);
  }
  if (category) { where.push('c.slug = ?'); params.push(String(category)); }
  if (minPrice !== null) { where.push('p.price_amd >= ?'); params.push(minPrice); }
  if (maxPrice !== null) { where.push('p.price_amd <= ?'); params.push(maxPrice); }

  const from = 'FROM products p JOIN users u ON u.id = p.seller_id JOIN categories c ON c.id = p.category_id WHERE ' + where.join(' AND ');
  const total = db.prepare(`SELECT COUNT(*) AS n ${from}`).get(...params).n;
  const rows = db.prepare(
    `SELECT p.id, p.title, p.price_amd, p.stock, p.rating_avg, p.rating_count, u.store_name, ${IMAGE_SQL} AS image
     ${from} ORDER BY ${SORTS[sort]} LIMIT ? OFFSET ?`,
  ).all(...params, config.pageSize, (page - 1) * config.pageSize);

  res.json({ items: rows.map(productCard), total, page, pages: Math.max(1, Math.ceil(total / config.pageSize)) });
});

router.get('/products/:id', (req, res) => {
  const id = intParam(req.params.id);
  const p = id && db.prepare(
    `SELECT p.*, u.store_name, c.name AS category_name, c.slug AS category_slug
     FROM products p JOIN users u ON u.id = p.seller_id JOIN categories c ON c.id = p.category_id WHERE p.id = ?`,
  ).get(id);
  // Unpublished products are visible only to their own seller.
  if (!p || (!p.is_published && req.user?.id !== p.seller_id)) throw notFound('Product not found.');
  const images = db.prepare('SELECT id, file_path, position FROM product_images WHERE product_id = ? ORDER BY position').all(p.id).map(imageOut);
  res.json({
    product: {
      id: p.id, title: p.title, description: p.description, priceAmd: p.price_amd, stock: p.stock,
      isPublished: !!p.is_published, ratingAvg: p.rating_avg, ratingCount: p.rating_count, createdAt: p.created_at,
      category: { name: p.category_name, slug: p.category_slug },
      seller: { id: p.seller_id, storeName: p.store_name },
      isOwn: req.user?.id === p.seller_id,
      images,
    },
  });
});

router.get('/products/:id/reviews', (req, res) => {
  const id = intParam(req.params.id);
  if (!id || !db.prepare('SELECT 1 FROM products WHERE id = ?').get(id)) throw notFound('Product not found.');
  const rows = db.prepare(
    `SELECT r.id, r.rating, r.body, r.created_at, u.name FROM reviews r JOIN users u ON u.id = r.buyer_id
     WHERE r.product_id = ? ORDER BY r.created_at DESC, r.id DESC LIMIT 50`,
  ).all(id);
  res.json({ reviews: rows.map((r) => ({ id: r.id, rating: r.rating, body: r.body, createdAt: r.created_at, author: r.name.split(' ')[0] })) });
});

export default router;
