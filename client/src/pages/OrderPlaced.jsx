import { Link, useParams } from 'react-router-dom';
import { get } from '../api.js';
import { useI18n } from '../i18n.jsx';
import { Alert, StatusBadge, useLoad, useTitle } from '../components/ui.jsx';

export default function OrderPlaced() {
  const { t, dateTime, money, region } = useI18n();
  const { id } = useParams();
  useTitle(t('placed.label'));
  const [{ loading, data, error }] = useLoad(() => get(`/orders/${id}`), [id]);
  if (loading) return <div className="wrap page"><p className="muted">{t('common.loading')}</p></div>;
  if (error) return <div className="wrap page"><Alert>{error.message}</Alert></div>;
  const o = data.order;
  return (
    <div className="wrap page narrow">
      <div className="confirm">
        <p className="confirm-label">{t('placed.label')}</p>
        <h1>{t('placed.order', { id: o.id })}</h1>
        <p>{t('placed.thanks', { name: o.recipient })} {o.sellerOrders.length > 1 ? t('placed.split', { n: o.sellerOrders.length }) : t('placed.single')}</p>
        <p className="muted small">{dateTime(o.createdAt)}</p>
      </div>
      <dl className="facts">
        <div><dt>{t('placed.total')}</dt><dd>{money(o.totalAmd)}</dd></div>
        <div><dt>{t('placed.deliverTo')}</dt><dd>{o.recipient}, {o.phone}<br />{o.street}{o.apartment ? `, ${t('addr.apt', { n: o.apartment })}` : ''}<br />{o.city}, {region(o.region)}</dd></div>
      </dl>
      <ul className="plain">
        {o.sellerOrders.map((so) => <li key={so.id}><span>{so.seller.storeName}</span> <StatusBadge status={so.status} /></li>)}
      </ul>
      <p className="actions"><Link className="btn" to={`/orders/${o.id}`}>{t('placed.view')}</Link> <Link className="btn btn-outline" to="/search">{t('placed.keep')}</Link></p>
    </div>
  );
}
