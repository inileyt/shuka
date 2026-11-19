import { useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { get, put } from '../api.js';
import { useAuth } from '../auth.jsx';
import { useI18n } from '../i18n.jsx';
import { Alert, Rating, Stars, Stepper, useLoad, useTitle } from '../components/ui.jsx';

export default function Product() {
  const { t, tm, money, date, cat, stock: stockLabel } = useI18n();
  const { id } = useParams();
  const { user, refresh } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const [{ loading, data, error }] = useLoad(() => get(`/products/${id}`), [id]);
  const [reviews] = useLoad(() => get(`/products/${id}/reviews`), [id]);
  const [active, setActive] = useState(0);
  const [qty, setQty] = useState(1);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const p = data?.product;
  useTitle(p?.title);

  if (loading) return <div className="wrap page"><p className="muted">{t('common.loading')}</p></div>;
  if (error) return <div className="wrap page narrow"><h1>{error.status === 404 ? t('product.notFound') : t('common.error')}</h1><p className="muted">{tm(error.message)}</p><Link to="/search">{t('product.browse')}</Link></div>;

  const stock = stockLabel(p.stock);
  const addToCart = async () => {
    if (!user) return nav(`/login?next=${encodeURIComponent(loc.pathname)}`);
    setBusy(true); setMsg(null);
    try {
      await put(`/cart/items/${p.id}`, { quantity: qty, add: true });
      await refresh();
      setMsg({ tone: 'success', text: t('product.added'), cart: true });
    } catch (err) {
      setMsg({ tone: 'error', text: err.message });
    } finally { setBusy(false); }
  };

  return (
    <div className="wrap page">
      <p className="crumbs small"><Link to="/search">{t('search.allProducts')}</Link> / <Link to={`/search?category=${p.category.slug}`}>{cat(p.category.slug, p.category.name)}</Link></p>
      {!p.isPublished && <Alert tone="warn">{t('product.unpublished')}</Alert>}
      <div className="product-layout">
        <div className="gallery">
          <div className="gallery-main">{p.images[active] ? <img src={p.images[active].url} alt={p.title} width="900" height="900" /> : <div className="noimg" />}</div>
          {p.images.length > 1 && (
            <div className="gallery-thumbs">
              {p.images.map((im, i) => (
                <button key={im.id} className={i === active ? 'on' : ''} onClick={() => setActive(i)} aria-label={t('product.showImage', { n: i + 1 })}>
                  <img src={im.thumb} alt="" width="80" height="80" />
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="product-info">
          <h1>{p.title}</h1>
          <Rating avg={p.ratingAvg} count={p.ratingCount} />
          <div className="price price-big">{money(p.priceAmd)}</div>
          <p className={`stock stock-${stock.tone}`}>{stock.text}</p>
          <p className="muted">{t('product.soldBy')} <strong>{p.seller.storeName}</strong></p>

          {p.isOwn ? (
            <p><Link className="btn btn-outline" to={`/seller/products/${p.id}/edit`}>{t('product.edit')}</Link></p>
          ) : (
            <div className="buy-box">
              <div className="buy-row">
                <Stepper value={qty} min={1} max={Math.max(1, p.stock)} onChange={setQty} disabled={p.stock === 0} />
                <button className="btn btn-big" disabled={busy || p.stock === 0 || !p.isPublished} onClick={addToCart}>
                  {p.stock === 0 ? t('stock.out') : busy ? t('product.adding') : t('product.add')}
                </button>
              </div>
              {msg && <Alert tone={msg.tone}>{msg.tone === 'error' ? tm(msg.text) : msg.text} {msg.cart && <Link to="/cart">{t('product.goCart')}</Link>}</Alert>}
              <p className="muted small">{t('product.payNote')}</p>
            </div>
          )}
          <h2 className="h-small">{t('product.description')}</h2>
          <p className="prewrap">{p.description}</p>
        </div>
      </div>

      <section className="reviews">
        <h2>{t('reviews.title')}</h2>
        {reviews.data?.reviews.length === 0 && <p className="muted">{t('reviews.none')}</p>}
        <ul className="review-list">
          {reviews.data?.reviews.map((r) => (
            <li key={r.id}>
              <div className="review-head"><Stars value={r.rating} /> <strong>{r.author}</strong> <span className="muted small">{date(r.createdAt)}</span></div>
              {r.body && <p className="prewrap">{r.body}</p>}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
