import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { get, post } from '../../api.js';
import { useI18n } from '../../i18n.jsx';
import { Alert, StatusBadge, StatusHistory, useLoad, useTitle } from '../../components/ui.jsx';

// Buttons exist only for the moves the server allows from the current status.
const DANGER = { cancelled: true };

export default function SellerOrderDetail() {
  const { t, tm, dateTime, money, region } = useI18n();
  const { id } = useParams();
  const [{ loading, data, error }, setData] = useLoad(() => get(`/seller/orders/${id}`), [id]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  useTitle(data ? t('placed.order', { id: data.order.orderId }) : t('sod.crumb'));

  if (loading) return <p className="muted">{t('common.loading')}</p>;
  if (error) return <div><h2>{t('od.notFound')}</h2><p className="muted">{tm(error.message)}</p><Link to="/seller/orders">{t('sod.back')}</Link></div>;
  const o = data.order;

  const move = async (to) => {
    if (to === 'cancelled' && !window.confirm(t('sod.confirmCancel'))) return;
    setBusy(true); setErr(null);
    try { setData(await post(`/seller/orders/${id}/status`, { to })); }
    catch (e) { setErr(e.message); try { setData(await get(`/seller/orders/${id}`)); } catch { /* keep the old view */ } }
    finally { setBusy(false); }
  };

  return (
    <div>
      <p className="crumbs small"><Link to={`/seller/orders?status=${o.status}`}>{t('sod.crumb')}</Link> / #{o.orderId}</p>
      <div className="row-between">
        <h2>{t('placed.order', { id: o.orderId })}</h2>
        <StatusBadge status={o.status} />
      </div>
      <p className="muted">{t('sod.placed', { date: dateTime(o.createdAt) })}</p>
      <Alert>{err}</Alert>

      <div className="detail-layout">
        <div>
          <section className="part-card">
            <h3 className="h-small">{t('sod.items')}</h3>
            <ul className="lines">
              {o.items.map((it, i) => (
                <li key={i}><div className="line"><span>{it.title}</span><span className="muted small">{it.quantity} × {money(it.unitPriceAmd)}</span><strong>{money(it.unitPriceAmd * it.quantity)}</strong></div></li>
              ))}
            </ul>
            <div className="subtotal"><span>{t('sod.cash')}</span><strong className="cash">{money(o.cashToCollectAmd)}</strong></div>
          </section>

          <section className="part-card">
            <h3 className="h-small">{t('sod.move')}</h3>
            {o.allowedMoves.length === 0
              ? <p className="muted">{t('sod.final', { status: t(`status.${o.status}`) })}</p>
              : <div className="actions">{o.allowedMoves.map((to) => (
                <button key={to} className={`btn ${DANGER[to] ? 'btn-outline btn-danger' : ''}`} disabled={busy} onClick={() => move(to)}>{t(`move.${to}`)}</button>
              ))}</div>}
            <h3 className="h-tiny">{t('od.history')}</h3>
            <StatusHistory history={o.history} />
          </section>
        </div>

        <aside className="summary">
          <h3 className="h-small">{t('sod.deliverTo')}</h3>
          <p><strong>{o.recipient}</strong><br /><a href={`tel:${o.phone.replace(/\s/g, '')}`}>{o.phone}</a></p>
          <p>{o.street}{o.apartment ? `, ${t('addr.apt', { n: o.apartment })}` : ''}<br />{o.city}, {region(o.region)}</p>
          {o.note ? <p className="prewrap"><span className="muted small">{t('sod.noteFrom')}</span><br />{o.note}</p> : <p className="muted small">{t('sod.noNote')}</p>}
        </aside>
      </div>
    </div>
  );
}
