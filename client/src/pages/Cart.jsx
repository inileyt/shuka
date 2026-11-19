import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { del, get, put } from '../api.js';
import { useAuth } from '../auth.jsx';
import { useI18n } from '../i18n.jsx';
import { Alert, Stepper, useLoad, useTitle } from '../components/ui.jsx';

function Warning({ item, onAccept }) {
  const { t, money } = useI18n();
  if (item.unavailable) return <p className="item-warn">{t('cart.warn.unavailable')}</p>;
  if (item.soldOut) return <p className="item-warn">{t('cart.warn.soldOut')}</p>;
  if (item.exceedsStock) return <p className="item-warn">{t('cart.warn.exceeds', { n: item.stock })}</p>;
  if (item.priceChanged) {
    return (
      <p className="item-warn">
        {t('cart.warn.price', { old: money(item.priceWhenAdded), new: money(item.priceAmd) })}{' '}
        <button className="link-btn" onClick={onAccept}>{t('cart.acceptPrice')}</button>
      </p>
    );
  }
  return null;
}

export default function Cart() {
  const { t, money } = useI18n();
  useTitle(t('cart.title'));
  const { refresh } = useAuth();
  const nav = useNavigate();
  const [{ loading, data, error }, setState] = useLoad(() => get('/cart'), []);
  const [err, setErr] = useState(null);
  const cart = data?.cart;

  const run = async (fn) => {
    setErr(null);
    try { setState({ cart: (await fn()).cart }); await refresh(); } catch (e) { setErr(e.message); }
  };
  const setQty = (item, quantity, acceptPrice) => run(() => put(`/cart/items/${item.productId}`, { quantity, acceptPrice }));
  const remove = (item) => run(() => del(`/cart/items/${item.productId}`));

  if (loading) return <div className="wrap page"><p className="muted">{t('common.loading')}</p></div>;
  return (
    <div className="wrap page">
      <h1>{t('cart.title')}</h1>
      <Alert>{error?.message || err}</Alert>
      {cart && cart.groups.length === 0 && (
        <div className="empty"><p><strong>{t('cart.empty')}</strong></p><Link className="btn" to="/search">{t('cart.find')}</Link></div>
      )}
      {cart && cart.groups.length > 0 && (
        <div className="cart-layout">
          <div>
            {cart.groups.map((g) => (
              <section key={g.sellerId} className="cart-group">
                <h2 className="h-small">{t('cart.soldBy', { store: g.storeName })}</h2>
                {g.items.map((it) => (
                  <div key={it.productId} className={`cart-item ${it.hasIssue ? 'has-issue' : ''}`}>
                    <Link to={`/products/${it.productId}`} className="cart-thumb">{it.thumb ? <img src={it.thumb} alt="" width="96" height="96" /> : <div className="noimg" />}</Link>
                    <div className="cart-main">
                      <Link to={`/products/${it.productId}`} className="cart-title">{it.title}</Link>
                      <div className="price">{money(it.priceAmd)}</div>
                      <Warning item={it} onAccept={() => setQty(it, Math.min(it.quantity, Math.max(1, it.stock)), true)} />
                    </div>
                    <div className="cart-side">
                      <Stepper value={it.quantity} min={1} max={Math.max(1, it.stock)} disabled={it.unavailable || it.soldOut} onChange={(n) => setQty(it, n)} />
                      <button className="link-btn danger" onClick={() => remove(it)}>{t('cart.remove')}</button>
                    </div>
                  </div>
                ))}
                <div className="subtotal"><span>{t('cart.subtotalFor', { store: g.storeName })}</span><strong>{money(g.subtotalAmd)}</strong></div>
              </section>
            ))}
          </div>
          <aside className="summary">
            <h2 className="h-small">{t('cart.summary')}</h2>
            <div className="summary-row"><span>{t('cart.items')}</span><span>{cart.itemCount}</span></div>
            <div className="summary-row total"><span>{t('cart.total')}</span><strong>{money(cart.totalAmd)}</strong></div>
            <p className="muted small">{t('cart.payment')}</p>
            {cart.hasIssues && <Alert tone="warn">{t('cart.fix')}</Alert>}
            <button className="btn btn-big" disabled={cart.hasIssues} onClick={() => nav('/checkout')}>{t('cart.checkout')}</button>
          </aside>
        </div>
      )}
    </div>
  );
}
