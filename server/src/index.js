import './boot.js';
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import cookieParser from 'cookie-parser';
import { config } from './config.js';
import { db } from './db.js';
import { scheduleDailyBackup } from './backup.js';
import { attachUser, sameOrigin } from './lib/auth.js';
import { errorHandler, notFound } from './lib/errors.js';
import authRoutes from './routes/auth.js';
import catalogRoutes from './routes/catalog.js';
import cartRoutes from './routes/cart.js';
import orderRoutes from './routes/orders.js';
import reviewRoutes from './routes/reviews.js';
import sellerRoutes from './routes/seller.js';
import adminRoutes from './routes/admin.js';

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1); // behind the HTTPS proxy of the host
app.use((_req, res, next) => {
  res.set({ 'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY', 'Referrer-Policy': 'same-origin' });
  next();
});
app.use(express.json({ limit: '100kb' }));
app.use(cookieParser());

app.use('/uploads', express.static(config.uploadDir, { maxAge: '30d', immutable: true, fallthrough: false }));

app.get('/api/health', (_req, res) => res.json({ ok: db.prepare('SELECT 1 AS ok').get().ok === 1 }));
app.use('/api', sameOrigin, attachUser, authRoutes, catalogRoutes, cartRoutes, orderRoutes, reviewRoutes, sellerRoutes, adminRoutes);
app.use('/api', (_req, _res, next) => next(notFound('Endpoint not found.')));

// The built frontend is served by this same process.
const indexHtml = path.join(config.clientDist, 'index.html');
if (fs.existsSync(indexHtml)) {
  app.use(express.static(config.clientDist, { index: false, maxAge: '1h' }));
  app.use((req, res, next) => (req.method === 'GET' && !req.path.startsWith('/uploads') ? res.sendFile(indexHtml) : next()));
}

app.use(errorHandler);

app.listen(config.port, () => {
  console.log(`Shuka is running on http://localhost:${config.port}`);
  scheduleDailyBackup();
});

const stop = () => { db.close(); process.exit(0); };
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
