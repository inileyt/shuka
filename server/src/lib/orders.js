import { db, now } from '../db.js';
import { conflict, forbidden, notFound } from './errors.js';

// The only place that decides whether a status move is allowed.
export const ALLOWED_MOVES = {
  placed: ['confirmed', 'cancelled'],
  confirmed: ['shipped', 'cancelled'],
  shipped: ['delivered'],
  delivered: [],
  cancelled: [],
};

const getSellerOrder = db.prepare('SELECT id, status, seller_id, order_id FROM seller_orders WHERE id = ?');
const setStatus = db.prepare('UPDATE seller_orders SET status = ?, updated_at = ? WHERE id = ?');
const addHistory = db.prepare('INSERT INTO status_history (seller_order_id, from_status, to_status, changed_by, created_at) VALUES (?, ?, ?, ?, ?)');
const itemsOf = db.prepare('SELECT product_id, quantity FROM order_items WHERE seller_order_id = ?');
const restock = db.prepare('UPDATE products SET stock = stock + ?, updated_at = ? WHERE id = ?');

// actor is 'seller' or 'buyer'. One IMMEDIATE transaction: the status is re-read inside it,
// so two clicks at once cannot both succeed, and the stock goes back in the same transaction as the cancel.
export const moveSellerOrder = db.transaction((sellerOrderId, to, userId, actor) => {
  const so = getSellerOrder.get(sellerOrderId);
  if (!so) throw notFound('Order not found.');
  if (!ALLOWED_MOVES[so.status].includes(to)) {
    throw conflict('MOVE_NOT_ALLOWED', `An order that is ${so.status} cannot move to ${to}.`);
  }
  if (actor === 'buyer' && to !== 'cancelled') throw forbidden('Only the seller can move this order forward.');
  const ts = now();
  setStatus.run(to, ts, sellerOrderId);
  addHistory.run(sellerOrderId, so.status, to, userId, ts);
  if (to === 'cancelled') for (const it of itemsOf.all(sellerOrderId)) restock.run(it.quantity, ts, it.product_id);
  return { from: so.status, to };
}).immediate;
