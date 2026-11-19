import crypto from 'node:crypto';
import { config } from '../config.js';
import { db } from '../db.js';
import { forbidden, unauthorized } from './errors.js';

const COOKIE = 'shuka_session';

// Signed session: base64url(payload).HMAC. The cookie is httpOnly, so page scripts cannot read it.
const sign = (data) => crypto.createHmac('sha256', config.sessionSecret).update(data).digest('base64url');

export function setSession(res, userId) {
  const exp = Date.now() + config.sessionDays * 86400_000;
  const payload = Buffer.from(JSON.stringify({ uid: userId, exp })).toString('base64url');
  res.cookie(COOKIE, `${payload}.${sign(payload)}`, {
    httpOnly: true, sameSite: 'lax', secure: config.isProd, maxAge: config.sessionDays * 86400_000, path: '/',
  });
}

export const clearSession = (res) => res.clearCookie(COOKIE, { path: '/' });

function readSession(req) {
  const raw = req.cookies?.[COOKIE];
  if (!raw) return null;
  const [payload, sig] = raw.split('.');
  if (!payload || !sig) return null;
  const expected = sign(payload);
  if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  try {
    const { uid, exp } = JSON.parse(Buffer.from(payload, 'base64url').toString());
    return exp > Date.now() ? uid : null;
  } catch {
    return null;
  }
}

const userStmt = db.prepare('SELECT id, email, name, phone, store_name FROM users WHERE id = ?');

export function attachUser(req, _res, next) {
  const uid = readSession(req);
  const u = uid ? userStmt.get(uid) ?? null : null;
  req.user = u && { ...u, isAdmin: config.adminEmails.includes(u.email.toLowerCase()) };
  next();
}

export function requireAuth(req, _res, next) {
  if (!req.user) return next(unauthorized());
  next();
}

export function requireSeller(req, _res, next) {
  if (!req.user) return next(unauthorized());
  if (!req.user.store_name) return next(forbidden('Become a seller first.'));
  next();
}

export function requireAdmin(req, _res, next) {
  if (!req.user) return next(unauthorized());
  if (!req.user.isAdmin) return next(forbidden('This area is for the site owner.'));
  next();
}

// Cross-site writes are refused: if the browser sends an Origin, it must be this host.
export function sameOrigin(req, _res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const origin = req.get('origin');
  if (origin) {
    let host;
    try { host = new URL(origin).host; } catch { return next(forbidden('Bad origin.')); }
    if (host !== req.get('host') && !(host.startsWith('localhost:') && !config.isProd)) return next(forbidden('Cross-site request refused.'));
  }
  next();
}
