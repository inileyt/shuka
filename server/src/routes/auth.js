import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { db, now } from '../db.js';
import { config } from '../config.js';
import { badRequest, clean, conflict, unauthorized } from '../lib/errors.js';
import { clearSession, requireAuth, setSession } from '../lib/auth.js';

export const PHONE_RE = /^\+?[0-9][0-9\s\-()]{5,19}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 10);

const router = Router();

function me(user) {
  const cart = db.prepare('SELECT COALESCE(SUM(quantity), 0) AS n FROM cart_items WHERE user_id = ?').get(user.id);
  const last = db.prepare('SELECT recipient, phone, region, city, street, apartment FROM orders WHERE buyer_id = ? ORDER BY id DESC LIMIT 1').get(user.id);
  return {
    id: user.id, email: user.email, name: user.name, phone: user.phone,
    storeName: user.store_name, isSeller: !!user.store_name, isAdmin: config.adminEmails.includes(user.email.toLowerCase()), cartCount: cart.n, lastAddress: last ?? null,
  };
}

router.post('/auth/register', async (req, res) => {
  const email = clean(req.body?.email).toLowerCase();
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  const name = clean(req.body?.name);
  const phone = clean(req.body?.phone);
  const fields = {};
  if (!EMAIL_RE.test(email) || email.length > 200) fields.email = 'Enter a valid email address.';
  if (password.length < 8 || password.length > 100) fields.password = 'Use 8 to 100 characters.';
  if (name.length < 2 || name.length > 80) fields.name = 'Enter your name (2 to 80 characters).';
  if (!PHONE_RE.test(phone)) fields.phone = 'Enter a valid phone number, for example +374 91 123456.';
  if (Object.keys(fields).length) throw badRequest('Check the highlighted fields.', fields);

  const hash = await bcrypt.hash(password, 10);
  try {
    const r = db.prepare('INSERT INTO users (email, password_hash, name, phone, created_at) VALUES (?, ?, ?, ?, ?)').run(email, hash, name, phone, now());
    setSession(res, r.lastInsertRowid);
    const user = db.prepare('SELECT id, email, name, phone, store_name FROM users WHERE id = ?').get(r.lastInsertRowid);
    res.status(201).json({ user: me(user) });
  } catch (err) {
    if (String(err.code).startsWith('SQLITE_CONSTRAINT')) throw conflict('EMAIL_TAKEN', 'An account with this email already exists.', { fields: { email: 'This email is already registered.' } });
    throw err;
  }
});

router.post('/auth/login', async (req, res) => {
  const email = clean(req.body?.email).toLowerCase();
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  const row = db.prepare('SELECT id, email, name, phone, store_name, password_hash FROM users WHERE email = ?').get(email);
  const ok = await bcrypt.compare(password, row?.password_hash ?? DUMMY_HASH);
  if (!row || !ok) throw unauthorized('Wrong email or password.');
  setSession(res, row.id);
  res.json({ user: me(row) });
});

router.post('/auth/logout', (_req, res) => {
  clearSession(res);
  res.json({ ok: true });
});

router.get('/me', requireAuth, (req, res) => res.json({ user: me(req.user) }));

router.patch('/me', requireAuth, (req, res) => {
  const name = req.body?.name === undefined ? req.user.name : clean(req.body.name);
  const phone = req.body?.phone === undefined ? req.user.phone : clean(req.body.phone);
  const fields = {};
  if (name.length < 2 || name.length > 80) fields.name = 'Enter your name (2 to 80 characters).';
  if (!PHONE_RE.test(phone)) fields.phone = 'Enter a valid phone number.';
  if (Object.keys(fields).length) throw badRequest('Check the highlighted fields.', fields);
  db.prepare('UPDATE users SET name = ?, phone = ? WHERE id = ?').run(name, phone, req.user.id);
  res.json({ user: me({ ...req.user, name, phone }) });
});

export default router;
