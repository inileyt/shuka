# Shuka

Amazon-style marketplace for Armenia. Prices in AMD, cash on delivery, one Node.js process, one SQLite file.

Home page: a category menu (picture tiles) and a row of products for every category (`GET /api/home`).

Demo product pictures are [Twemoji](https://github.com/jdecked/twemoji) illustrations (CC-BY 4.0), drawn by `npm run seed`. Sellers upload their own photos in the product editor.

Stack: React + Vite (frontend), Node.js + Express (API), better-sqlite3 (SQLite, WAL mode), multer + sharp (images), bcryptjs (passwords), httpOnly session cookie.

## Run locally (one command)

Needs Node.js 20 or newer.

```bash
npm install
npm run local
```

`npm run local` builds the frontend, applies the migrations, fills the database with demo data and starts the server on http://localhost:3000.

Demo accounts (password `Passw0rd!`):

| Role | Email |
| --- | --- |
| Seller (Ararat Tech) | seller1@shuka.test |
| Seller (Sevan Home) | seller2@shuka.test |
| Seller (Vanadzor Market) | seller3@shuka.test |
| Buyer | buyer1@shuka.test, buyer2@shuka.test |

## Languages

The site is in Armenian (default), Russian and English. Use the switcher in the header (Հայ / Рус / EN); the choice is remembered in the browser. Error messages from the server are translated too. Product titles and descriptions are written by sellers, so the demo products stay in English.

## Owner area (see all orders and registered people)

Sign in as the owner and open **Owner area** in the account menu (or go to `/admin`). It is read only: an overview (people, sellers, orders, money), every order with buyer, address, sellers and status history, every registered person, and CSV downloads of orders and people (open them in Excel or Google Sheets).

Who is the owner is set by the `ADMIN_EMAIL` environment variable (several emails separated by commas). On a local machine the demo owner `admin@shuka.test` (password `Passw0rd!`) works without any setting. To use your own account: register on the site, then start with `ADMIN_EMAIL=you@mail.com npm start`. In production `ADMIN_EMAIL` has no default, so set it.

Development with hot reload (API on 3000, frontend on 5173): `npm run dev`.

## Commands

| Command | What it does |
| --- | --- |
| `npm run migrate` | Applies `server/migrations/*.sql` in order (version kept in `PRAGMA user_version`) |
| `npm run seed` | Categories, 3 sellers, 2 buyers, 45 products with images, some finished orders and reviews |
| `npm run backup` | Copies the database with `VACUUM INTO` to `data/backups/` |
| `npm run test:break` | The 10 break-it tests from the brief (start the server first) |

The server also writes a backup at start-up and then once a day (the last 14 are kept).

## Break-it tests

Start the server (`npm start`), then in another terminal:

```bash
npm run test:break
# against the live site (the foreign-key test is skipped for remote URLs):
BASE_URL=https://your-app.example npm run test:break
```

They cover (the 10th checks that the owner area is closed to everyone else): last units (30 parallel checkouts for stock 3), double click, price changed, old order after edit, someone else's order, moves that are not allowed, cancel returns stock, foreign keys, bad uploads.

## Where the hard parts live

| Problem | File |
| --- | --- |
| Overselling, double checkout, price check, order split | `server/src/routes/orders.js` (one `BEGIN IMMEDIATE` transaction, `UPDATE ... WHERE stock >= ?`, `request_key UNIQUE`) |
| Allowed status moves, stock returned on cancel | `server/src/lib/orders.js` |
| WAL, foreign keys, busy timeout | `server/src/db.js` |
| Images: type and size check, resize, files on disk | `server/src/lib/images.js` |
| Every query scoped to the current user | `server/src/routes/seller.js`, `orders.js` |
| Schema (10 STRICT tables) | `server/migrations/001_init.sql` |

## Deploy

The host needs a **persistent disk** (Fly.io or Railway with a volume, Render with a disk, or a small VPS with Caddy). Serverless hosts lose the database on every deploy.

Environment variables:

| Variable | Meaning |
| --- | --- |
| `NODE_ENV=production` | Secure cookies; the server refuses to start without `SESSION_SECRET` |
| `SESSION_SECRET` | Long random string, for example `openssl rand -hex 32` |
| `DATA_DIR` | Folder on the persistent disk. It holds `shuka.db`, `uploads/` and `backups/` |
| `ADMIN_EMAIL` | Email of the owner account (comma separated for more than one) |
| `PORT` | Port to listen on (default 3000) |

Build and start:

```bash
npm ci
npm run build
npm run migrate
npm run seed      # once, for demo data (skipped if users already exist)
npm start
```

Serve it over HTTPS (the host or Caddy does this). The app trusts one proxy hop, so session cookies are marked `secure` behind it.

## Deploy from GitHub

1. Create a repository on GitHub and push the project (`node_modules/`, `client/dist/` and `data/` are already in `.gitignore`):
   ```bash
   git init && git add . && git commit -m "Shuka"
   git branch -M main
   git remote add origin https://github.com/YOUR_NAME/shuka.git
   git push -u origin main
   ```
2. On Render or Railway choose "New project / Web service from GitHub repo" and select the repository.
3. Build command: `npm ci && npm run build`. Start command: `npm run migrate && npm start`.
4. Add a **persistent disk / volume** (for example mounted at `/data`) and set the variables from the table above: `NODE_ENV=production`, `SESSION_SECRET`, `DATA_DIR=/data`, `ADMIN_EMAIL=your@email`.
5. Every `git push` to `main` redeploys. Expect a short downtime per deploy and run a single instance only (SQLite).
6. Demo data (`npm run seed`) needs a shell on the host; without it, register your own users and sellers instead.

Notes: Render disks need a paid web service (about $7/month plus $0.25/GB for the disk); Railway offers volumes on its plans (check current limits). Test that backups in `DATA_DIR/backups` actually appear. Do not commit `.env` files.
