import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { get, post } from '../api.js';
import { useI18n } from '../i18n.jsx';
import { Alert, Field, StarInput, StatusBadge, StatusHistory, useLoad, useTitle } from '../components/ui.jsx';

function ReviewForm({ item, onDone }) {
  const { t } = useI18n();
  const [rating, setRating] = useState(0);
  const [body, setBody] = useState('');
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setErr(null);
    try { await post(`/products/${item.productId}/reviews`, { rating, body }); onDone(); }
    catch (ex) { setErr(ex); setBusy(false); }
  };
  return (
    <form className="review-form" onSubmit={submit}>
      <Field label={t('rv.rating')} error={err?.fields?.rating}><StarInput value={rating} onChange={setRating} /></Field>
      <Field label={t('rv.body')} error={err?.fields?.body}><textarea rows="3" value={body} onChange={(e) => setBody(e.target.value)} maxLength="1000" /></Field>
      {err && !Object.keys(err.fields).length && <Alert>{err.message}</Alert>}
      <button className="btn btn-small" disabled={busy || !rating}>{busy ? t('rv.saving') : t('rv.submit')}</button>
    </form>
  );
}

export default function OrderDetail() {
  const { t, tm, dateTime, money, region } = useI18n();
  const { id } = useParams();
  const [{ loading, data, error }, setData] = useLoad(() => get(`/orders/${id}`), [id]);
  const [openReview, setOpenReview] = useState(null);
  const [err, setErr] = useState(null);
  useTitle(t('placed.order', { id }));

  if (loading) return <div className="wrap page"><p className="muted">{t('common.loading')}</p></div>;
  if (error) return <div className="wrap page narrow"><h1>{t('od.notFound')}</h1><p className="muted">{tm(error.message)}</p><Link to="/orders">{t('od.back')}</Link></div>;
  const o = data.order;
  const reload = async () => setData(await get(`/orders/${id}`));
  const cancel = async (so) => {
    if (!window.confirm(t('od.confirmCancel', { store: so.seller.storeName }))) return;
    setErr(null);
    try { setData(await post(`/orders/${o.id}/sellers/${so.id}/cancel`)); }
    catch (e) { setErr(e.message); await reload().catch(() => {}); }
  };

  return (
    <div className="wrap page">
      <p className="crumbs small"><Link to="/orders">{t('nav.myOrders')}</Link> / {t('placed.order', { id: o.id })}</p>
      <h1>{t('placed.order', { id: o.id })}</h1>
      <p className="muted">{t('od.placedOn', { date: dateTime(o.createdAt), method: t('payment.cod') })}</p>
      <Alert>{err}</Alert>
      <div className="detail-layout">
        <div>
          {o.sellerOrders.map((so) => (
            <section key={so.id} className="part-card">
              <div className="row-between">
                <h2 className="h-small">{t('cart.soldBy', { store: so.seller.storeName })}</h2>
                <StatusBadge status={so.status} />
              </div>
              <ul className="lines">
                {so.items.map((it) => (
                  <li key={it.productId}>
                    <div className="line">
                      <Link to={`/products/${it.productId}`}>{it.title}</Link>
                      <span className="muted small">{it.quantity} × {money(it.unitPriceAmd)}</span>
                      <strong>{money(it.unitPriceAmd * it.quantity)}</strong>
                    </div>
                    {it.canReview && openReview !== it.productId && <button className="link-btn" onClick={() => setOpenReview(it.productId)}>{t('od.review')}</button>}
                    {it.reviewed && <span className="muted small">{t('od.reviewed')}</span>}
                    {openReview === it.productId && it.canReview && <ReviewForm item={it} onDone={async () => { setOpenReview(null); await reload(); }} />}
                  </li>
                ))}
              </ul>
              <div className="subtotal"><span>{t('od.subtotal')}</span><strong>{money(so.subtotalAmd)}</strong></div>
              <h3 className="h-tiny">{t('od.history')}</h3>
              <StatusHistory history={so.history} />
              {so.canCancel && <button className="btn btn-outline btn-danger btn-small" onClick={() => cancel(so)}>{t('od.cancel')}</button>}
            </section>
          ))}
        </div>
        <aside className="summary">
          <h2 className="h-small">{t('od.delivery')}</h2>
          <p>{o.recipient}<br />{o.phone}<br />{o.street}{o.apartment ? `, ${t('addr.apt', { n: o.apartment })}` : ''}<br />{o.city}, {region(o.region)}</p>
          {o.note && <p className="muted small prewrap">{t('od.note', { note: o.note })}</p>}
          <div className="summary-row total"><span>{t('od.totalCod')}</span><strong>{money(o.totalAmd)}</strong></div>
        </aside>
      </div>
    </div>
  );
}
