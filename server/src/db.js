import fs from 'node:fs';
import Database from 'better-sqlite3';
import { config } from './config.js';

fs.mkdirSync(config.dataDir, { recursive: true });
fs.mkdirSync(config.uploadDir, { recursive: true });

export const db = new Database(config.dbPath);

// These must be set on every connection.
db.pragma('journal_mode = WAL');     // readers do not block the writer
db.pragma('foreign_keys = ON');      // off by default in SQLite
db.pragma('busy_timeout = 5000');    // wait up to 5 s instead of failing with SQLITE_BUSY
db.pragma('synchronous = NORMAL');

export const now = () => new Date().toISOString();
