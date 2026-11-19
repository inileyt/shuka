import { imageUrl, thumbPath } from './images.js';

export const REGIONS = ['Yerevan', 'Aragatsotn', 'Ararat', 'Armavir', 'Gegharkunik', 'Kotayk', 'Lori', 'Shirak', 'Syunik', 'Tavush', 'Vayots Dzor'];

export const IMAGE_SQL = '(SELECT file_path FROM product_images WHERE product_id = p.id ORDER BY position LIMIT 1)';

export const productCard = (r) => ({
  id: r.id, title: r.title, priceAmd: r.price_amd, stock: r.stock, ratingAvg: r.rating_avg, ratingCount: r.rating_count,
  storeName: r.store_name,
  thumb: r.image ? imageUrl(thumbPath(r.image)) : null,
  image: r.image ? imageUrl(r.image) : null,
});

export const imageOut = (i) => ({ id: i.id, url: imageUrl(i.file_path), thumb: imageUrl(thumbPath(i.file_path)), position: i.position });

export const intParam = (v) => (/^\d+$/.test(String(v)) ? Number(v) : null);
