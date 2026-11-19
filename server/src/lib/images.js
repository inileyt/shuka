import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import multer from 'multer';
import sharp from 'sharp';
import { config } from '../config.js';
import { AppError } from './errors.js';

const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp']);

// Files are held in memory only while the request runs (max 5 MB each, max 5 files).
export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.maxUploadBytes, files: config.maxImagesPerProduct },
  fileFilter(_req, file, cb) {
    if (!ALLOWED.has(file.mimetype)) {
      return cb(new AppError(400, 'BAD_UPLOAD', `"${file.originalname}" is not an image. Use JPG, PNG or WebP.`));
    }
    cb(null, true);
  },
});

export const thumbPath = (largePath) => largePath.replace('-lg.webp', '-th.webp');
export const imageUrl = (p) => `/uploads/${p}`;

// Decodes the file for real (a renamed .exe fails here), then writes a large and a thumbnail version.
// Runs BEFORE any database transaction so transactions stay short.
export async function processImage(file) {
  try {
    const base = crypto.randomBytes(12).toString('hex');
    const img = sharp(file.buffer, { failOn: 'error' }).rotate();
    const meta = await img.metadata();
    if (!['jpeg', 'png', 'webp'].includes(meta.format)) throw new Error('format');
    await img.clone().resize({ width: 1200, height: 1200, fit: 'inside', withoutEnlargement: true }).webp({ quality: 82 }).toFile(path.join(config.uploadDir, `${base}-lg.webp`));
    await img.clone().resize({ width: 360, height: 360, fit: 'cover' }).webp({ quality: 78 }).toFile(path.join(config.uploadDir, `${base}-th.webp`));
    return `${base}-lg.webp`;
  } catch {
    throw new AppError(400, 'BAD_UPLOAD', `"${file.originalname}" is not a valid image file.`);
  }
}

export function removeImageFiles(largePath) {
  for (const p of [largePath, thumbPath(largePath)]) fs.rm(path.join(config.uploadDir, p), { force: true }, () => {});
}
