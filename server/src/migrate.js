import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { config } from './config.js';
import { db } from './db.js';

// Numbered .sql files (001_init.sql, 002_...). The applied version is kept in PRAGMA user_version.
export function migrate() {
  const files = fs.readdirSync(config.migrationsDir).filter((f) => /^\d+_.+\.sql$/.test(f)).sort();
  let version = db.pragma('user_version', { simple: true });
  let applied = 0;
  for (const file of files) {
    const n = parseInt(file, 10);
    if (n <= version) continue;
    const sql = fs.readFileSync(path.join(config.migrationsDir, file), 'utf8');
    db.exec('BEGIN');
    try {
      db.exec(sql);
      db.pragma(`user_version = ${n}`);
      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      throw new Error(`Migration ${file} failed: ${err.message}`);
    }
    console.log(`migrated: ${file}`);
    version = n;
    applied++;
  }
  if (!applied) console.log(`database is up to date (version ${version})`);
  return version;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) migrate();
