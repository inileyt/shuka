// Demo data: categories, 3 sellers, 2 buyers, 45 products with illustrated images, a few delivered orders with reviews.
// Safe to run twice: it does nothing if users already exist.
import crypto from 'node:crypto';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import bcrypt from 'bcryptjs';
import sharp from 'sharp';
import { config } from './config.js';
import { db } from './db.js';
import { migrate } from './migrate.js';

migrate();
if (db.prepare('SELECT COUNT(*) AS n FROM users').get().n > 0) {
  console.log('seed skipped: the database already has users. Delete the data folder to start fresh.');
  process.exit(0);
}

const PASSWORD = 'Passw0rd!';
const CATEGORIES = [
  ['Electronics', 'electronics', 215], ['Home & Kitchen', 'home-kitchen', 28], ['Garden', 'garden', 135],
  ['Clothing', 'clothing', 340], ['Shoes & Bags', 'shoes-bags', 20], ['Books & Stationery', 'books-stationery', 45],
  ['Sports & Outdoors', 'sports-outdoors', 175], ['Beauty & Care', 'beauty-care', 320], ['Toys & Kids', 'toys-kids', 55],
  ['Food & Drinks', 'food-drinks', 30],
];
const SELLERS = [
  ['seller1@shuka.test', 'Ararat Tech', 'Hayk Mkrtchyan', '+374 91 100100', ['electronics', 'sports-outdoors', 'toys-kids']],
  ['seller2@shuka.test', 'Sevan Home', 'Anahit Sargsyan', '+374 93 200200', ['home-kitchen', 'garden', 'books-stationery']],
  ['seller3@shuka.test', 'Vanadzor Market', 'Narek Hovhannisyan', '+374 77 300300', ['clothing', 'shoes-bags', 'beauty-care', 'food-drinks']],
];
// [category, title, price AMD, stock, description]
const PRODUCTS = [
  ['electronics', 'Wireless Bluetooth Headphones', 18500, 25, 'Over-ear headphones with 30 hours of battery life, soft ear cushions and a built-in microphone for calls.'],
  ['electronics', 'Portable Power Bank 20000 mAh', 14900, 40, 'Charges a phone four to five times. Two USB ports and one USB-C, with a small battery level display.'],
  ['electronics', 'Smart Watch with Heart Rate Monitor', 32000, 12, 'Tracks steps, sleep and heart rate. Water resistant, with a bright 1.4 inch screen and a three-day battery.'],
  ['electronics', 'USB-C Fast Charger 65W', 9800, 60, 'One compact charger for a laptop, a tablet and a phone. Folding plug, fits in any bag.'],
  ['electronics', 'Mechanical Keyboard, Compact', 27500, 2, 'Tenkeyless keyboard with tactile switches and white backlight. Detachable USB-C cable.'],
  ['home-kitchen', 'Ceramic Coffee Mug Set, 4 pieces', 6500, 30, 'Four hand-glazed mugs, 300 ml each. Dishwasher and microwave safe.'],
  ['home-kitchen', 'Non-stick Frying Pan 28 cm', 11900, 18, 'Even heating, a cool-touch handle and a durable non-stick coating. Works on gas and induction.'],
  ['home-kitchen', 'Electric Kettle 1.7 L', 12500, 22, 'Boils a litre of water in about three minutes. Stainless steel body, automatic shut-off.'],
  ['home-kitchen', 'Cotton Bed Linen Set, Double', 24000, 9, 'Soft 100 percent cotton duvet cover, fitted sheet and two pillowcases. Does not fade after washing.'],
  ['home-kitchen', 'Wooden Cutting Board, Walnut', 7800, 35, 'Thick end-grain board with a juice groove. Oiled and ready to use.'],
  ['garden', 'Garden Pruning Shears', 5200, 45, 'Sharp steel blades and a non-slip grip. Cuts branches up to 20 mm.'],
  ['garden', 'Ceramic Plant Pot with Saucer, 20 cm', 4300, 50, 'A glazed pot with a drainage hole. Looks good indoors and on a balcony.'],
  ['garden', 'Vegetable Seeds Set, 12 varieties', 3400, 80, 'Tomato, cucumber, pepper, basil and more. Seeds suited to the Armenian climate, with sowing dates on each packet.'],
  ['garden', 'Watering Can 5 L', 3900, 0, 'Light plastic can with a long spout and a removable rose head for gentle watering.'],
  ['clothing', 'Wool Scarf, Charcoal', 8900, 28, 'Warm and soft merino blend scarf, 180 cm long. A good gift for winter.'],
  ['clothing', 'Classic Denim Jacket', 29000, 14, 'Medium-weight denim jacket, regular fit. Two chest pockets and metal buttons.'],
  ['clothing', 'Cotton T-shirt, Pack of 3', 9500, 55, 'Plain crew-neck t-shirts in white, grey and navy. Pre-washed so they keep their size.'],
  ['clothing', 'Knitted Wool Socks, 3 pairs', 4800, 70, 'Thick socks knitted from a wool blend. Warm even in very cold weather.'],
  ['clothing', 'Waterproof Rain Jacket', 21500, 16, 'Light jacket with taped seams and an adjustable hood. Folds into its own pocket.'],
  ['shoes-bags', 'Leather Backpack, 18 L', 34500, 8, 'Full-grain leather backpack with a padded laptop sleeve for 14 inch laptops.'],
  ['shoes-bags', 'Everyday Canvas Sneakers', 16500, 24, 'Comfortable low-top sneakers with a cushioned insole. Sizes 38 to 45.'],
  ['shoes-bags', 'Canvas Tote Bag', 2900, 90, 'Strong cotton tote with an inner pocket. Carries up to 10 kg.'],
  ['shoes-bags', 'Travel Duffel Bag, 40 L', 19800, 11, 'Water-resistant duffel with a shoulder strap and a separate shoe compartment.'],
  ['books-stationery', 'Hardcover Notebook A5, Dotted', 2400, 100, 'Thick 120 gsm paper that does not bleed through. 192 pages, ribbon bookmark.'],
  ['books-stationery', 'Gel Pens, Set of 12 Colors', 2100, 120, 'Smooth gel pens with 0.5 mm tips. Fast drying ink.'],
  ['books-stationery', 'Armenian Folk Tales, Illustrated', 5600, 30, 'A collection of traditional tales retold for children, with colour illustrations on every page.'],
  ['books-stationery', 'Desk Organizer, Bamboo', 6900, 19, 'Five compartments for pens, notes and a phone. Natural bamboo, no assembly needed.'],
  ['sports-outdoors', 'Yoga Mat, 6 mm', 8500, 33, 'Non-slip surface and dense foam that is kind to knees. Comes with a carrying strap.'],
  ['sports-outdoors', 'Adjustable Dumbbell Set, 20 kg', 38000, 6, 'Two handles and four plate sizes. Locks safely and stores in a small space.'],
  ['sports-outdoors', 'Insulated Steel Water Bottle, 750 ml', 7200, 48, 'Keeps drinks cold for 24 hours or hot for 12. Leak-proof lid.'],
  ['sports-outdoors', 'Two-person Camping Tent', 45000, 5, 'Quick-pitch tent with a waterproof flysheet and two ventilation windows. 2.4 kg.'],
  ['sports-outdoors', 'Trekking Poles, Pair', 15500, 15, 'Lightweight aluminium poles with cork grips and adjustable length.'],
  ['beauty-care', 'Natural Lavender Soap, 3 bars', 3200, 60, 'Cold-process soap made with olive oil and dried lavender. No artificial fragrance.'],
  ['beauty-care', 'Hand Cream with Shea Butter', 2600, 75, 'Rich cream that absorbs quickly and leaves no greasy feel. 75 ml tube.'],
  ['beauty-care', 'Bamboo Toothbrush, Pack of 4', 1900, 85, 'Soft bristles and biodegradable handles. A simple way to cut plastic waste.'],
  ['beauty-care', 'Herbal Shampoo, 400 ml', 3800, 42, 'Gentle shampoo with thyme and nettle extract for everyday use.'],
  ['toys-kids', 'Wooden Building Blocks, 100 pieces', 9200, 20, 'Smooth, painted blocks in many shapes. Packed in a cotton bag. Ages 3 and up.'],
  ['toys-kids', 'Jigsaw Puzzle, 1000 pieces', 5400, 26, 'A landscape of Mount Ararat on thick cardboard pieces that fit tightly.'],
  ['toys-kids', 'Kids Art Set, 86 pieces', 7600, 17, 'Crayons, markers, colour pencils and watercolours in a carry case.'],
  ['toys-kids', 'Plush Bear, 40 cm', 6300, 3, 'A soft bear with a stitched face that is safe for babies. Machine washable.'],
  ['food-drinks', 'Dried Apricots, 500 g', 3600, 150, 'Sun-dried apricots from the Ararat valley. No sugar added, no preservatives.'],
  ['food-drinks', 'Mountain Herbal Tea Blend, 100 g', 2800, 90, 'Thyme, mint and rosehip picked in the mountains of Syunik. Loose leaf.'],
  ['food-drinks', 'Wildflower Honey, 700 g', 5800, 40, 'Raw honey from small apiaries in Tavush. Thick, aromatic and never heated.'],
  ['food-drinks', 'Walnut and Dried Fruit Gift Box', 8900, 21, 'A box of walnuts, dried cherries, figs and apricots. Neatly packed for gifts.'],
  ['food-drinks', 'Traditional Lavash, Pack of 10', 1500, 4, 'Thin, soft Armenian flatbread baked in a tonir. Best eaten within a week.'],
];

// Product pictures: Twemoji illustrations (CC-BY 4.0, https://github.com/jdecked/twemoji) on a coloured backdrop.
// One emoji per product, in the same order as PRODUCTS. Sellers upload their own photos through the product editor.
const EMOJI = [
  '1f3a7', '1f50b', '231a', '1f50c', '2328',            // electronics
  '2615', '1f373', '1fad6', '1f6cf', '1f52a',           // home & kitchen
  '2702', '1fab4', '1f331', '1faa3',                    // garden
  '1f9e3', '1f9e5', '1f455', '1f9e6', '2614',           // clothing
  '1f392', '1f45f', '1f45c', '1f9f3',                   // shoes & bags
  '1f4d3', '1f58a', '1f4d6', '1f5c2',                   // books & stationery
  '1f9d8', '1f3cb', '1f964', '26fa', '1f97e',           // sports
  '1f9fc', '1f9f4', '1faa5', '1f33f',                   // beauty
  '1f9f1', '1f9e9', '1f3a8', '1f9f8',                   // toys
  '1f351', '1f375', '1f36f', '1f330', '1fad3',          // food
];
const emojiDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'node_modules', '@twemoji', 'svg');
const emojiInner = (code) => {
  const svg = fs.readFileSync(path.join(emojiDir, `${code}.svg`), 'utf8');
  return svg.slice(svg.indexOf('>', svg.indexOf('<svg')) + 1, svg.lastIndexOf('</svg>'));
};
const glyph = (inner, x, y, size, rot = 0, shadow = true) =>
  `<g transform="rotate(${rot} ${x + size / 2} ${y + size / 2})">` +
  (shadow ? `<ellipse cx="${x + size / 2}" cy="${y + size * 0.97}" rx="${size * 0.36}" ry="${size * 0.045}" fill="#1b2340" opacity="0.14"/>` : '') +
  `<svg x="${x}" y="${y}" width="${size}" height="${size}" viewBox="0 0 36 36">${inner}</svg></g>`;

// Four different views per product: hero, pair, pattern, close-up.
function picture(code, hue, k) {
  const inner = emojiInner(code);
  const bg = (h1, h2) => `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${h1} 60% 93%)"/><stop offset="1" stop-color="hsl(${h2} 55% 82%)"/></linearGradient></defs><rect width="900" height="900" fill="url(#g)"/>`;
  let body;
  if (k === 0) body = bg(hue, hue + 25) + `<circle cx="450" cy="450" r="340" fill="#fff" opacity="0.55"/>` + glyph(inner, 190, 170, 520, -4);
  else if (k === 1) body = bg(hue + 15, hue + 40) + `<circle cx="300" cy="330" r="230" fill="#fff" opacity="0.45"/>` + glyph(inner, 90, 120, 440, -8) + glyph(inner, 430, 380, 330, 10);
  else if (k === 2) {
    const cells = [];
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) cells.push(glyph(inner, 40 + c * 290 + (r % 2) * 20, 40 + r * 290, 240, ((r + c) % 3 - 1) * 12, false));
    body = bg(hue - 10, hue + 10) + cells.join('');
  } else body = bg(hue + 30, hue + 55) + `<circle cx="450" cy="450" r="400" fill="#fff" opacity="0.35"/>` + glyph(inner, -90, -60, 1080, 6, false);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="900" viewBox="0 0 900 900">${body}</svg>`;
}
async function makeImage(code, hue, k) {
  const base = crypto.randomBytes(12).toString('hex');
  const svg = Buffer.from(picture(code, hue, k));
  await sharp(svg).resize(900, 900).webp({ quality: 85 }).toFile(path.join(config.uploadDir, `${base}-lg.webp`));
  await sharp(svg).resize(360, 360).webp({ quality: 80 }).toFile(path.join(config.uploadDir, `${base}-th.webp`));
  return `${base}-lg.webp`;
}

const iso = (daysAgo, extraMin = 0) => new Date(Date.now() - daysAgo * 86400_000 + extraMin * 60_000).toISOString();
const hash = bcrypt.hashSync(PASSWORD, 10);

const insUser = db.prepare('INSERT INTO users (email, password_hash, name, phone, store_name, created_at) VALUES (?, ?, ?, ?, ?, ?)');
const catId = {}, hueOf = {}, sellerOf = {};
for (const [name, slug, hue] of CATEGORIES) { catId[slug] = db.prepare('INSERT INTO categories (name, slug) VALUES (?, ?)').run(name, slug).lastInsertRowid; hueOf[slug] = hue; }
for (const [email, store, name, phone, cats] of SELLERS) {
  const id = insUser.run(email, hash, name, phone, store, iso(60)).lastInsertRowid;
  cats.forEach((c) => { sellerOf[c] = id; });
}
if (config.adminEmails.includes('admin@shuka.test')) insUser.run('admin@shuka.test', hash, 'Shuka Owner', '+374 10 000000', null, iso(70));
const buyers = [['buyer1@shuka.test', 'Lilit Grigoryan', '+374 94 400400'], ['buyer2@shuka.test', 'Tigran Avetisyan', '+374 99 500500']]
  .map(([e, n, p]) => insUser.run(e, hash, n, p, null, iso(50)).lastInsertRowid);

const insProduct = db.prepare(
  `INSERT INTO products (seller_id, category_id, title, description, price_amd, stock, is_published, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)`,
);
const insImage = db.prepare('INSERT INTO product_images (product_id, file_path, position) VALUES (?, ?, ?)');
const productIds = [];
for (let i = 0; i < PRODUCTS.length; i++) {
  const [slug, title, price, stock, desc] = PRODUCTS[i];
  const created = iso(PRODUCTS.length - i, i);
  const imgs = [];
  const n = 2 + (i % 3); // 2 to 4 images
  for (let k = 0; k < n; k++) imgs.push(await makeImage(EMOJI[i], hueOf[slug], k));
  db.transaction(() => {
    const id = insProduct.run(sellerOf[slug], catId[slug], title, desc, price, stock, created, created).lastInsertRowid;
    imgs.forEach((p, k) => insImage.run(id, p, k));
    productIds.push(id);
  })();
}

// A few finished orders with reviews, so ratings and "units sold" have something to show.
const insOrder = db.prepare(`INSERT INTO orders (buyer_id, recipient, phone, region, city, street, apartment, note, total_amd, request_key, created_at)
  VALUES (?, ?, ?, 'Yerevan', 'Yerevan', 'Tumanyan, 12', '5', '', ?, ?, ?)`);
const insSO = db.prepare('INSERT INTO seller_orders (order_id, seller_id, status, subtotal_amd, updated_at) VALUES (?, ?, ?, ?, ?)');
const insItem = db.prepare('INSERT INTO order_items (seller_order_id, product_id, title, unit_price_amd, quantity) VALUES (?, ?, ?, ?, ?)');
const insHist = db.prepare('INSERT INTO status_history (seller_order_id, from_status, to_status, changed_by, created_at) VALUES (?, ?, ?, ?, ?)');
const insReview = db.prepare('INSERT INTO reviews (product_id, buyer_id, rating, body, created_at) VALUES (?, ?, ?, ?, ?)');
const REVIEWS = [
  [5, 'Exactly as described, arrived the next day.'], [4, 'Good quality for the price.'], [5, 'Very happy with it. I would buy again.'],
  [3, 'Fine, but smaller than I expected.'], [4, 'Works well. Packed carefully.'], [5, 'Excellent. The seller was quick to confirm.'],
];
db.transaction(() => {
  for (let i = 0; i < 24; i++) {
    const pIdx = (i * 7) % PRODUCTS.length;
    const [slug, title, price] = PRODUCTS[pIdx];
    const buyer = buyers[i % 2], qty = 1 + (i % 2), days = 30 - i;
    const orderId = insOrder.run(buyer, i % 2 ? 'Tigran Avetisyan' : 'Lilit Grigoryan', i % 2 ? '+374 99 500500' : '+374 94 400400', price * qty, `seed-${i}`, iso(days)).lastInsertRowid;
    const status = i % 6 === 5 ? 'shipped' : i % 8 === 7 ? 'placed' : 'delivered';
    const soId = insSO.run(orderId, sellerOf[slug], status, price * qty, iso(days - 3)).lastInsertRowid;
    insItem.run(soId, productIds[pIdx], title, price, qty);
    const steps = ['placed', 'confirmed', 'shipped', 'delivered'];
    for (let s = 0; s < steps.indexOf(status) + 1; s++) insHist.run(soId, s ? steps[s - 1] : null, steps[s], s ? sellerOf[slug] : buyer, iso(days - s));
    if (status === 'delivered') {
      const [rating, body] = REVIEWS[i % REVIEWS.length];
      insReview.run(productIds[pIdx], buyer, rating, body, iso(days - 4));
    }
  }
  db.exec(`UPDATE products SET rating_avg = COALESCE((SELECT ROUND(AVG(rating), 2) FROM reviews WHERE product_id = products.id), 0),
                               rating_count = (SELECT COUNT(*) FROM reviews WHERE product_id = products.id)`);
})();

console.log(`seeded: ${CATEGORIES.length} categories, ${SELLERS.length} sellers, ${buyers.length} buyers, ${PRODUCTS.length} products.`);
console.log(`demo logins (password ${PASSWORD}): seller1@shuka.test, seller2@shuka.test, seller3@shuka.test, buyer1@shuka.test, buyer2@shuka.test\nowner (admin area /admin): admin@shuka.test`);
