// "Break-it" tests from the Shuka brief. Start the server first (npm start), then: npm run test:break
// Optional: BASE_URL=https://your-app.example npm run test:break   (the foreign-key test needs local database access and is skipped for remote URLs)
import sharp from 'sharp';

const BASE = process.env.BASE_URL || 'http://localhost:3000';
const REMOTE = !/localhost|127\.0\.0\.1/.test(BASE);
const RUN = Date.now().toString(36);
let counter = 0;

class Client {
  cookie = '';
  async req(method, path, { json, form } = {}) {
    const headers = {};
    if (this.cookie) headers.cookie = this.cookie;
    let body;
    if (json !== undefined) { headers['content-type'] = 'application/json'; body = JSON.stringify(json); }
    if (form) body = form;
    const res = await fetch(`${BASE}/api${path}`, { method, headers, body });
    for (const c of res.headers.getSetCookie?.() ?? []) {
      const pair = c.split(';')[0];
      if (pair.startsWith('shuka_session=')) this.cookie = pair.endsWith('=') ? '' : pair;
    }
    let data = null;
    try { data = await res.json(); } catch { /* empty body */ }
    return { status: res.status, data };
  }
}

async function newUser(prefix) {
  const c = new Client();
  const r = await c.req('POST', '/auth/register', { json: { email: `${prefix}-${RUN}-${++counter}@test.local`, password: 'Passw0rd!', name: `Tester ${prefix}`, phone: '+374 91 000000' } });
  if (r.status !== 201) throw new Error(`register failed: ${JSON.stringify(r.data)}`);
  return c;
}
async function newSeller(prefix = 'seller') {
  const c = await newUser(prefix);
  const r = await c.req('POST', '/seller/activate', { json: { storeName: `Store ${prefix} ${RUN} ${++counter}`, phone: '+374 91 111111' } });
  if (r.status !== 201) throw new Error(`activate failed: ${JSON.stringify(r.data)}`);
  return c;
}
const png = (color = '#c0392b') => sharp({ create: { width: 400, height: 400, channels: 3, background: color } }).png().toBuffer();

async function newProduct(seller, { stock = 10, price = 10000, title = 'Break test product' } = {}) {
  const cats = (await seller.req('GET', '/categories')).data.categories;
  const form = new FormData();
  form.set('title', `${title} ${RUN}-${++counter}`);
  form.set('description', 'A product created by the automated break-it tests.');
  form.set('price', String(price));
  form.set('stock', String(stock));
  form.set('categoryId', String(cats[0].id));
  form.append('images', new Blob([await png()], { type: 'image/png' }), 'a.png');
  const r = await seller.req('POST', '/seller/products', { form });
  if (r.status !== 201) throw new Error(`create product failed: ${JSON.stringify(r.data)}`);
  return r.data.product;
}
const address = (key) => ({ requestKey: key, recipient: 'Test Buyer', phone: '+374 91 222222', region: 'Yerevan', city: 'Yerevan', street: 'Tumanyan', building: '5', apartment: '12', note: '' });
const key = () => `key-${RUN}-${++counter}-${Math.random().toString(36).slice(2)}`;
const stockOf = async (id) => (await new Client().req('GET', `/products/${id}`)).data.product.stock;

async function buyOne(buyer, product, qty = 1) {
  await buyer.req('PUT', `/cart/items/${product.id}`, { json: { quantity: qty } });
  return buyer.req('POST', '/orders', { json: address(key()) });
}

const results = [];
async function test(name, fn) {
  try {
    const detail = await fn();
    results.push([true, name, detail]);
    console.log(`PASS  ${name}${detail ? ` (${detail})` : ''}`);
  } catch (err) {
    results.push([false, name, err.message]);
    console.log(`FAIL  ${name}\n      ${err.message}`);
  }
}
const expect = (cond, msg) => { if (!cond) throw new Error(msg); };

await test('1. Last units: 30 checkouts at once for stock 3', async () => {
  const seller = await newSeller('s1');
  const product = await newProduct(seller, { stock: 3 });
  const buyers = await Promise.all(Array.from({ length: 30 }, () => newUser('b1')));
  await Promise.all(buyers.map((b) => b.req('PUT', `/cart/items/${product.id}`, { json: { quantity: 1 } })));
  const answers = await Promise.all(buyers.map((b) => b.req('POST', '/orders', { json: address(key()) })));
  const ok = answers.filter((a) => a.status === 201).length;
  const conflicts = answers.filter((a) => a.status === 409).length;
  const other = answers.filter((a) => ![201, 409].includes(a.status));
  expect(ok === 3, `expected 3 orders, got ${ok}`);
  expect(conflicts === 27, `expected 27 answers of 409, got ${conflicts}`);
  expect(other.length === 0, `unexpected answers: ${other.map((a) => a.status).join(',')}`);
  expect(!answers.some((a) => /locked|busy/i.test(JSON.stringify(a.data))), 'a "database is locked" error appeared');
  expect(answers.find((a) => a.status === 409).data.error.code === 'OUT_OF_STOCK', 'the 409 should say OUT_OF_STOCK');
  const stock = await stockOf(product.id);
  expect(stock === 0, `stock should be 0, is ${stock}`);
  return '3 orders, 27 x 409, stock 0';
});

await test('2. Double click: same request key twice gives one order', async () => {
  const seller = await newSeller('s2');
  const product = await newProduct(seller, { stock: 10 });
  const buyer = await newUser('b2');
  await buyer.req('PUT', `/cart/items/${product.id}`, { json: { quantity: 2 } });
  const k = key();
  const [a, b] = await Promise.all([buyer.req('POST', '/orders', { json: address(k) }), buyer.req('POST', '/orders', { json: address(k) })]);
  expect(a.status < 300 && b.status < 300, `both calls should succeed, got ${a.status} and ${b.status}`);
  expect(a.data.order.id === b.data.order.id, 'the two answers are different orders');
  const list = (await buyer.req('GET', '/orders')).data.orders;
  expect(list.length === 1, `expected 1 order, found ${list.length}`);
  expect(await stockOf(product.id) === 8, 'stock was reduced more than once');
});

await test('3. Price changed after adding to cart: checkout stops with the new price', async () => {
  const seller = await newSeller('s3');
  const product = await newProduct(seller, { price: 10000 });
  const buyer = await newUser('b3');
  await buyer.req('PUT', `/cart/items/${product.id}`, { json: { quantity: 1 } });
  await seller.req('PATCH', `/seller/products/${product.id}`, { json: { price: 12500 } });
  const cart = (await buyer.req('GET', '/cart')).data.cart;
  expect(cart.hasIssues && cart.groups[0].items[0].priceChanged, 'the cart should warn about the price change');
  const r = await buyer.req('POST', '/orders', { json: address(key()) });
  expect(r.status === 409 && r.data.error.code === 'PRICE_CHANGED', `expected 409 PRICE_CHANGED, got ${r.status}`);
  expect(r.data.error.newPriceAmd === 12500, 'the answer should contain the new price');
  expect(await stockOf(product.id) === 10, 'stock must not change when checkout stops');
  await buyer.req('PUT', `/cart/items/${product.id}`, { json: { quantity: 1, acceptPrice: true } });
  const ok = await buyer.req('POST', '/orders', { json: address(key()) });
  expect(ok.status === 201 && ok.data.order.totalAmd === 12500, 'checkout should work at the new price');
});

await test('4. Old order after editing the product keeps the old title and price', async () => {
  const seller = await newSeller('s4');
  const product = await newProduct(seller, { price: 7000, title: 'Original title' });
  const buyer = await newUser('b4');
  const placed = await buyOne(buyer, product, 2);
  expect(placed.status === 201, `order failed: ${placed.status}`);
  await seller.req('PATCH', `/seller/products/${product.id}`, { json: { title: 'Totally new title', price: 99000 } });
  const order = (await buyer.req('GET', `/orders/${placed.data.order.id}`)).data.order;
  const item = order.sellerOrders[0].items[0];
  expect(item.title === product.title, `title changed to "${item.title}"`);
  expect(item.unitPriceAmd === 7000 && order.totalAmd === 14000, 'price or total changed');
});

await test("5. Someone else's order: sellers and buyers see only their own", async () => {
  const sellerA = await newSeller('s5a');
  const sellerB = await newSeller('s5b');
  const pB = await newProduct(sellerB);
  const buyerA = await newUser('b5a');
  const buyerB = await newUser('b5b');
  const placed = await buyOne(buyerB, pB);
  const soId = placed.data.order.sellerOrders[0].id;
  const r1 = await sellerA.req('GET', `/seller/orders/${soId}`);
  expect([403, 404].includes(r1.status) && !JSON.stringify(r1.data).includes('Tumanyan'), `seller A got ${r1.status}`);
  const r2 = await buyerA.req('GET', `/orders/${placed.data.order.id}`);
  expect([403, 404].includes(r2.status) && !JSON.stringify(r2.data).includes('Tumanyan'), `buyer A got ${r2.status}`);
  const r3 = await sellerA.req('POST', `/seller/orders/${soId}/status`, { json: { to: 'confirmed' } });
  expect([403, 404].includes(r3.status), `seller A could change the status (${r3.status})`);
  const r4 = await buyerA.req('POST', `/orders/${placed.data.order.id}/sellers/${soId}/cancel`);
  expect([403, 404].includes(r4.status), `buyer A could cancel (${r4.status})`);
  const r5 = await sellerA.req('PATCH', `/seller/products/${pB.id}`, { json: { price: 1 } });
  expect([403, 404].includes(r5.status), `seller A could edit seller B's product (${r5.status})`);
  expect((await sellerB.req('GET', `/seller/orders/${soId}`)).status === 200, 'the real seller should see the order');
  return `${r1.status}, ${r2.status}, ${r3.status}, ${r4.status}, ${r5.status}`;
});

await test('6. Moves that are not allowed return 409 and change nothing', async () => {
  const seller = await newSeller('s6');
  const product = await newProduct(seller);
  const buyer = await newUser('b6');
  const placed = await buyOne(buyer, product);
  const soId = placed.data.order.sellerOrders[0].id;
  const skip = await seller.req('POST', `/seller/orders/${soId}/status`, { json: { to: 'delivered' } });
  expect(skip.status === 409, `Placed -> Delivered returned ${skip.status}`);
  let detail = (await seller.req('GET', `/seller/orders/${soId}`)).data.order;
  expect(detail.status === 'placed' && detail.history.length === 1, 'the failed move changed something');
  expect((await seller.req('POST', `/seller/orders/${soId}/status`, { json: { to: 'confirmed' } })).status === 200, 'Placed -> Confirmed should work');
  expect((await seller.req('POST', `/seller/orders/${soId}/status`, { json: { to: 'shipped' } })).status === 200, 'Confirmed -> Shipped should work');
  const cancel = await buyer.req('POST', `/orders/${placed.data.order.id}/sellers/${soId}/cancel`);
  expect(cancel.status === 409, `cancelling a shipped order returned ${cancel.status}`);
  detail = (await seller.req('GET', `/seller/orders/${soId}`)).data.order;
  expect(detail.status === 'shipped' && detail.history.length === 3, 'nothing should have changed');
  expect((await seller.req('POST', `/seller/orders/${soId}/status`, { json: { to: 'delivered' } })).status === 200, 'Shipped -> Delivered should work');
  const back = await seller.req('POST', `/seller/orders/${soId}/status`, { json: { to: 'shipped' } });
  expect(back.status === 409, 'a delivered order must not move back');
  const p2 = await newProduct(seller);
  const o2 = await buyOne(buyer, p2);
  const forward = await buyer.req('POST', `/seller/orders/${o2.data.order.sellerOrders[0].id}/status`, { json: { to: 'confirmed' } });
  expect(forward.status === 403, `a buyer moving an order forward got ${forward.status}`);
});

await test('7. Cancel returns the stock (once)', async () => {
  const seller = await newSeller('s7');
  const product = await newProduct(seller, { stock: 5 });
  const buyer = await newUser('b7');
  const placed = await buyOne(buyer, product, 3);
  expect(await stockOf(product.id) === 2, 'stock should be 2 after buying 3');
  const so = placed.data.order.sellerOrders[0].id;
  const c1 = await buyer.req('POST', `/orders/${placed.data.order.id}/sellers/${so}/cancel`);
  expect(c1.status === 200 && c1.data.order.sellerOrders[0].status === 'cancelled', 'cancel failed');
  expect(await stockOf(product.id) === 5, 'stock should be back to 5');
  const c2 = await buyer.req('POST', `/orders/${placed.data.order.id}/sellers/${so}/cancel`);
  expect(c2.status === 409, 'a second cancel should return 409');
  expect(await stockOf(product.id) === 5, 'stock must not be returned twice');
});

await test('8. Foreign keys: an order item for a missing product is rejected by SQLite', async () => {
  if (REMOTE) return 'skipped (remote URL)';
  const { db } = await import('../src/db.js');
  const so = db.prepare('SELECT id FROM seller_orders LIMIT 1').get();
  expect(so, 'no seller order in the database yet');
  let rejected = false;
  try {
    db.prepare('INSERT INTO order_items (seller_order_id, product_id, title, unit_price_amd, quantity) VALUES (?, 999999999, ?, 1, 1)').run(so.id, 'ghost');
  } catch (err) { rejected = /FOREIGN KEY/i.test(err.message); }
  expect(rejected, 'the insert was accepted');
  let blocked = false;
  try { db.prepare('DELETE FROM products WHERE id = (SELECT product_id FROM order_items LIMIT 1)').run(); } catch (err) { blocked = /FOREIGN KEY/i.test(err.message); }
  expect(blocked, 'a product that was ordered could be deleted');
  return 'insert rejected, delete of an ordered product blocked';
});

await test('9. Bad uploads: 30 MB file and a renamed .exe', async () => {
  const seller = await newSeller('s9');
  const cats = (await seller.req('GET', '/categories')).data.categories;
  const post = (blob, name) => {
    const form = new FormData();
    form.set('title', 'Upload test'); form.set('description', 'Testing the upload checks.');
    form.set('price', '1000'); form.set('stock', '1'); form.set('categoryId', String(cats[0].id));
    form.append('images', blob, name);
    return seller.req('POST', '/seller/products', { form });
  };
  const big = await post(new Blob([Buffer.alloc(30 * 1024 * 1024, 1)], { type: 'image/png' }), 'huge.png');
  expect(big.status === 400 && /large|MB/i.test(big.data.error.message), `30 MB file: ${big.status} ${JSON.stringify(big.data)}`);
  const exe = Buffer.concat([Buffer.from('MZ'), Buffer.alloc(2000, 7)]);
  const fake = await post(new Blob([exe], { type: 'image/png' }), 'virus.png');
  expect(fake.status === 400 && /image/i.test(fake.data.error.message), `renamed .exe: ${fake.status} ${JSON.stringify(fake.data)}`);
  const plain = await post(new Blob([exe], { type: 'application/x-msdownload' }), 'virus.exe');
  expect(plain.status === 400, `.exe with its own type: ${plain.status}`);
  expect((await seller.req('GET', '/seller/products')).data.products.length === 0, 'a product was created by a bad upload');
  return `${big.data.error.message}`;
});

await test('10. Owner area: normal users and visitors are refused', async () => {
  const nobody = new Client();
  const buyer = await newUser('b10');
  const seller = await newSeller('s10');
  for (const path of ['/admin/overview', '/admin/orders', '/admin/users', '/admin/export/users.csv', '/admin/export/orders.csv']) {
    expect((await nobody.req('GET', path)).status === 401, `visitor got ${(await nobody.req('GET', path)).status} on ${path}`);
    expect((await buyer.req('GET', path)).status === 403, `buyer was not refused on ${path}`);
    expect((await seller.req('GET', path)).status === 403, `seller was not refused on ${path}`);
  }
  expect(!JSON.stringify((await buyer.req('GET', '/me')).data).includes('password'), '/me leaks a password field');
});

const failed = results.filter((r) => !r[0]).length;
console.log(`\n${results.length - failed} of ${results.length} break-it tests passed.`);
process.exit(failed ? 1 : 0);
