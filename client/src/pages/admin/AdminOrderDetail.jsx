import { Link, useParams } from 'react-router-dom';
import { get } from '../../api.js';
import { useI18n } from '../../i18n.jsx';
import { Alert, StatusBadge, StatusHistory, useLoad, useTitle } from '../../components/ui.jsx';

export default function AdminOrderDetail() {
  const { t, dateTime, money, region } = useI18n();
  const { id } = useParams();
  useTitle(t('placed.order', { id }));
  const [{ loading, data, error }] = useLoad(() => get(`/admin/orders/${id}`), [id]);
  if (loading) return <p className="muted">{t('common.loading')}</p>;
  if (error) return <div><Alert>{error.message}</Alert><Link to="/admin/orders">{t('sod.back')}</Link></div>;
  const { order: o, buyer } = data;
  return (
    <div>
      <p className="crumbs small"><Link to="/admin/orders">{t('sod.crumb')}</Link> / #{o.id}</p>
      <h2>{t('placed.order', { id: o.id })}</h2>
      <p className="muted">{t('od.placedOn', { date: dateTime(o.createdAt), method: t('payment.cod') })}</p>
      <div className="detail-layout">
        <div>
          {o.sellerOrders.map((so) => (
            <section key={so.id} className="part-card">
              <div className="row-between"><h3 className="h-small">{t('adm.seller', { store: so.seller.storeName })}</h3><StatusBadge status={so.status} /></div>
              <ul className="lines">{so.items.map((it) => (
                <li key={it.productId}><div className="line"><span>{it.title}</span><span className="muted small">{it.quantity} × {money(it.unitPriceAmd)}</span><strong>{money(it.unitPriceAmd * it.quantity)}</strong></div></li>
              ))}</ul>
              <div className="subtotal"><span>{t('od.subtotal')}</span><strong>{money(so.subtotalAmd)}</strong></div>
              <h3 className="h-tiny">{t('od.history')}</h3>
              <StatusHistory history={so.history} />
            </section>
          ))}
        </div>
        <aside className="summary">
          <h3 className="h-small">{t('adm.buyerAccount')}</h3>
          <p>{buyer.name}<br />{buyer.email}</p>
          <h3 className="h-small">{t('sod.deliverTo')}</h3>
          <p>{o.recipient}<br />{o.phone}<br />{o.street}{o.apartment ? `, ${t('addr.apt', { n: o.apartment })}` : ''}<br />{o.city}, {region(o.region)}</p>
          {o.note && <p className="muted small prewrap">{t('od.note', { note: o.note })}</p>}
          <div className="summary-row total"><span>{t('cart.total')}</span><strong>{money(o.totalAmd)}</strong></div>
        </aside>
      </div>
    </div>
  );
}
