import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { config } from './config.js';
import { db } from './db.js';

// Consistent copy of the live database. VACUUM INTO must run outside a transaction.
export function backupDatabase() {
  fs.mkdirSync(config.backupDir, { recursive: true });
  const day = new Date().toISOString().slice(0, 10);
  const target = path.join(config.backupDir, `shuka-${day}.db`);
  if (fs.existsSync(target)) fs.rmSync(target);
  db.exec(`VACUUM INTO '${target.replace(/'/g, "''")}'`);
  // keep the last 14 daily backups
  const old = fs.readdirSync(config.backupDir).filter((f) => /^shuka-\d{4}-\d{2}-\d{2}\.db$/.test(f)).sort().slice(0, -14);
  for (const f of old) fs.rmSync(path.join(config.backupDir, f));
  return target;
}

// Writes a backup at start-up if today's does not exist yet, then re-checks hourly.
export function scheduleDailyBackup() {
  const check = () => {
    try {
      const day = new Date().toISOString().slice(0, 10);
      if (!fs.existsSync(path.join(config.backupDir, `shuka-${day}.db`))) console.log('backup written:', backupDatabase());
    } catch (err) {
      console.error('backup failed:', err.message);
    }
  };
  check();
  setInterval(check, 60 * 60 * 1000).unref();
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) console.log('backup written:', backupDatabase());
