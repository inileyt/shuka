import { Router } from 'express';
import { db } from '../db.js';
import { badRequest, notFound } from '../lib/errors.js';
import { requireAdmin } from '../lib/auth.js';
import { intParam } from '../lib/serialize.js';
import { buyerOrder } from './orders.js';

// Read-only owner area. Password hashes are never selected.
const router = Router();
router.use('/admin', requireAdmin);
const STATUSES = ['placed', 'confirmed', 'shipped', 'delivered', 'cancelled'];
const PAGE = 25;

const page = (req) => { const n = req.query.page ? intParam(req.query.page) : 1; if (!n || n < 1) throw badRequest('Page must be 1 or more.'); return n; };
const like = (q) => `%${String(q).trim().slice(0, 100).replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

router.get('/admin/overview', (_req, res) => {
  const one = (sql, ...a) => db.prepare(sql).get(...a).n;
  const byStatus = Object.fromEntries(STATUSES.map((s) => [s, 0]));
  for (const r of db.prepare('SELECT status, COUNT(*) AS n FROM seller_orders GROUP BY status').all()) byStatus[r.status] = r.n;
  const week = new Date(Date.now() - 7 * 86400_000).toISOString();
  res.json({
    users: one('SELECT COUNT(*) AS n FROM users'),
    newUsers7d: one('SELECT COUNT(*) AS n FROM users WHERE created_at >= ?', week),
    sellers: one('SELECT COUNT(*) AS n FROM users WHERE store_name IS NOT NULL'),
    products: one('SELECT COUNT(*) AS n FROM products'),
    orders: one('SELECT COUNT(*) AS n FROM orders'),
    orders7d: one('SELECT COUNT(*) AS n FROM orders WHERE created_at >= ?', week),
    sellerOrdersByStatus: byStatus,
    orderedValueAmd: one("SELECT COALESCE(SUM(subtotal_amd), 0) AS n FROM seller_orders WHERE status != 'cancelled'"),
    deliveredValueAmd: one("SELECT COALESCE(SUM(subtotal_amd), 0) AS n FROM seller_orders WHERE status = 'delivered'"),
  });
});

router.get('/admin/users', (req, res) => {
  const p = page(req);
  const q = req.query.q ? like(req.query.q) : null;
  const where = q ? "WHERE (u.name LIKE @q ESCAPE '\\' OR u.email LIKE @q ESCAPE '\\' OR u.phone LIKE @q ESCAPE '\\' OR u.store_name LIKE @q ESCAPE '\\')" : '';
  const total = db.prepare(`SELECT COUNT(*) AS n FROM users u ${where}`).get({ q }).n;
  const rows = db.prepare(
    `SELECT u.id, u.name, u.email, u.phone, u.store_name, u.created_at,
       (SELECT COUNT(*) FROM orders WHERE buyer_id = u.id) AS orders_placed,
       (SELECT COUNT(*) FROM products WHERE seller_id = u.id) AS products,
       (SELECT COUNT(*) FROM seller_orders WHERE seller_id = u.id) AS orders_received
     FROM users u ${where} ORDER BY u.id DESC LIMIT ${PAGE} OFFSET ${(p - 1) * PAGE}`,
  ).all({ q });
  res.json({
    total, page: p, pages: Math.max(1, Math.ceil(total / PAGE)),
    users: rows.map((r) => ({ id: r.id, name: r.name, email: r.email, phone: r.phone, storeName: r.store_name, createdAt: r.created_at, ordersPlaced: r.orders_placed, products: r.products, ordersReceived: r.orders_received })),
  });
});

const ORDER_SELECT = `SELECT o.id, o.created_at, o.total_amd, o.recipient, o.phone, o.city, o.region, u.name AS buyer_name, u.email AS buyer_email
  FROM orders o JOIN users u ON u.id = o.buyer_id`;

router.get('/admin/orders', (req, res) => {
  const p = page(req);
  const status = req.query.status ? String(req.query.status) : null;
  if (status && !STATUSES.includes(status)) throw badRequest('Unknown status.');
  const q = req.query.q ? like(req.query.q) : null;
  const conds = [];
  if (status) conds.push('EXISTS (SELECT 1 FROM seller_orders so WHERE so.order_id = o.id AND so.status = @status)');
  if (q) conds.push("(u.name LIKE @q ESCAPE '\\' OR u.email LIKE @q ESCAPE '\\' OR o.recipient LIKE @q ESCAPE '\\' OR o.phone LIKE @q ESCAPE '\\' OR CAST(o.id AS TEXT) = @exact)");
  const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
  const args = { status, q, exact: String(req.query.q ?? '').trim().replace(/^#/, '') };
  const total = db.prepare(`SELECT COUNT(*) AS n FROM orders o JOIN users u ON u.id = o.buyer_id ${where}`).get(args).n;
  const rows = db.prepare(`${ORDER_SELECT} ${where} ORDER BY o.id DESC LIMIT ${PAGE} OFFSET ${(p - 1) * PAGE}`).all(args);
  const parts = db.prepare('SELECT so.status, u.store_name FROM seller_orders so JOIN users u ON u.id = so.seller_id WHERE so.order_id = ? ORDER BY so.id');
  res.json({
    total, page: p, pages: Math.max(1, Math.ceil(total / PAGE)),
    orders: rows.map((r) => ({
      id: r.id, createdAt: r.created_at, totalAmd: r.total_amd, recipient: r.recipient, phone: r.phone, city: r.city, region: r.region,
      buyer: { name: r.buyer_name, email: r.buyer_email },
      parts: parts.all(r.id).map((x) => ({ status: x.status, storeName: x.store_name })),
    })),
  });
});

router.get('/admin/orders/:id', (req, res) => {
  const id = intParam(req.params.id);
  const row = id && db.prepare('SELECT o.buyer_id, u.name, u.email FROM orders o JOIN users u ON u.id = o.buyer_id WHERE o.id = ?').get(id);
  if (!row) throw notFound('Order not found.');
  res.json({ order: buyerOrder(id, row.buyer_id), buyer: { name: row.name, email: row.email } });
});

/* ---------- CSV exports (open in Excel or Google Sheets) ---------- */
const cell = (v) => {
  let s = v === null || v === undefined ? '' : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; // a spreadsheet must never run a cell as a formula
  return `"${s.replace(/"/g, '""')}"`;
};
const csv = (res, name, header, rows) => {
  res.set({ 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${name}"` });
  res.send('﻿' + [header, ...rows].map((r) => r.map(cell).join(',')).join('\r\n'));
};

router.get('/admin/export/users.csv', (_req, res) => {
  const rows = db.prepare('SELECT id, name, email, phone, store_name, created_at FROM users ORDER BY id').all();
  csv(res, 'shuka-users.csv', ['id', 'name', 'email', 'phone', 'store', 'registered'], rows.map((r) => [r.id, r.name, r.email, r.phone, r.store_name, r.created_at]));
});

router.get('/admin/export/orders.csv', (_req, res) => {
  const rows = db.prepare(
    `SELECT o.id AS order_id, o.created_at, b.name AS buyer, b.email AS buyer_email, o.recipient, o.phone, o.region, o.city, o.street, o.apartment,
       s.store_name AS seller, so.status, so.subtotal_amd, o.total_amd AS order_total,
       (SELECT group_concat(oi.quantity || ' x ' || oi.title, '; ') FROM order_items oi WHERE oi.seller_order_id = so.id) AS items
     FROM seller_orders so JOIN orders o ON o.id = so.order_id JOIN users b ON b.id = o.buyer_id JOIN users s ON s.id = so.seller_id
     ORDER BY o.id DESC, so.id`,
  ).all();
  csv(res, 'shuka-orders.csv',
    ['order', 'placed', 'buyer', 'buyer email', 'recipient', 'phone', 'region', 'city', 'street', 'apartment', 'seller', 'status', 'seller amount AMD', 'order total AMD', 'items'],
    rows.map((r) => [r.order_id, r.created_at, r.buyer, r.buyer_email, r.recipient, r.phone, r.region, r.city, r.street, r.apartment, r.seller, r.status, r.subtotal_amd, r.order_total, r.items]));
});

export default router;
