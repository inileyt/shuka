import { Link } from 'react-router-dom';
import { get } from '../api.js';
import { useI18n } from '../i18n.jsx';
import { Alert, StatusBadge, useLoad, useTitle } from '../components/ui.jsx';

export default function Orders() {
  const { t, date, money } = useI18n();
  useTitle(t('nav.myOrders'));
  const [{ loading, data, error }] = useLoad(() => get('/orders'), []);
  return (
    <div className="wrap page">
      <h1>{t('nav.myOrders')}</h1>
      <Alert>{error?.message}</Alert>
      {loading && <p className="muted">{t('common.loading')}</p>}
      {data && data.orders.length === 0 && <div className="empty"><p><strong>{t('orders.none')}</strong></p><Link className="btn" to="/search">{t('orders.browse')}</Link></div>}
      <ul className="order-list">
        {data?.orders.map((o) => (
          <li key={o.id}>
            <Link to={`/orders/${o.id}`} className="order-row">
              <div><strong>{t('placed.order', { id: o.id })}</strong><div className="muted small">{date(o.createdAt)}</div></div>
              <div className="order-parts">{o.sellerOrders.map((s) => <span key={s.id} className="part"><span className="small">{s.storeName}</span> <StatusBadge status={s.status} /></span>)}</div>
              <div className="order-total">{money(o.totalAmd)}</div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
