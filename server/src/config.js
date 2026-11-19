import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const isProd = process.env.NODE_ENV === 'production';

// Everything that must survive a deploy (database, uploads, backups) lives in DATA_DIR.
// On a host this must be a persistent disk / volume.
const dataDir = path.resolve(process.env.DATA_DIR || path.join(root, 'data'));

if (isProd && !process.env.SESSION_SECRET) {
  console.error('SESSION_SECRET must be set in production (use an environment variable).');
  process.exit(1);
}

// Owner accounts: a comma separated list of emails. On a local machine admin@shuka.test works out of the box.
const adminEmails = (process.env.ADMIN_EMAIL ?? (isProd ? '' : 'admin@shuka.test'))
  .split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);

export const config = {
  adminEmails,
  root,
  isProd,
  port: Number(process.env.PORT || 3000),
  dataDir,
  dbPath: path.join(dataDir, 'shuka.db'),
  uploadDir: path.join(dataDir, 'uploads'),
  backupDir: path.join(dataDir, 'backups'),
  migrationsDir: path.join(root, 'server', 'migrations'),
  clientDist: path.join(root, 'client', 'dist'),
  sessionSecret: process.env.SESSION_SECRET || 'dev-only-secret-change-me',
  sessionDays: 14,
  maxUploadBytes: 5 * 1024 * 1024,
  maxImagesPerProduct: 5,
  pageSize: 12,
};
