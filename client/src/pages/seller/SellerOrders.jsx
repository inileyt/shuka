import { Link, useSearchParams } from 'react-router-dom';
import { get } from '../../api.js';
import { useI18n } from '../../i18n.jsx';
import { STATUSES } from '../../format.js';
import { Alert, StatusBadge, useLoad, useTitle } from '../../components/ui.jsx';

export default function SellerOrders() {
  const { t, dateTime, money } = useI18n();
  useTitle(t('sor.title'));
  const [params, setParams] = useSearchParams();
  const status = STATUSES.includes(params.get('status')) ? params.get('status') : 'placed';
  const [{ loading, data, error }] = useLoad(() => get(`/seller/orders?status=${status}`), [status]);
  return (
    <div>
      <h2>{t('sor.title')}</h2>
      <div className="tabs tabs-status" role="tablist">
        {STATUSES.map((s) => (
          <button key={s} role="tab" aria-selected={s === status} className={s === status ? 'active' : ''} onClick={() => setParams({ status: s })}>
            {t(`status.${s}`)} <span className="count">{data?.counts[s] ?? '·'}</span>
          </button>
        ))}
      </div>
      <Alert>{error?.message}</Alert>
      {loading && !data && <p className="muted">{t('common.loading')}</p>}
      {data && data.orders.length === 0 && <div className="empty"><p className="muted">{t('sor.none', { status: t(`status.${status}`) })}</p></div>}
      {data && data.orders.length > 0 && (
        <div className="table-scroll">
          <table className="table">
            <thead><tr><th>{t('sor.order')}</th><th>{t('sor.placed')}</th><th>{t('sor.recipient')}</th><th className="num">{t('sor.units')}</th><th className="num">{t('sor.amount')}</th><th>{t('sor.status')}</th><th></th></tr></thead>
            <tbody>
              {data.orders.map((o) => (
                <tr key={o.id}>
                  <td><Link to={`/seller/orders/${o.id}`}>#{o.orderId}</Link></td>
                  <td>{dateTime(o.createdAt)}</td>
                  <td>{o.recipient}, {o.city}</td>
                  <td className="num">{o.units}</td>
                  <td className="num">{money(o.subtotalAmd)}</td>
                  <td><StatusBadge status={o.status} /></td>
                  <td><Link className="btn btn-outline btn-small" to={`/seller/orders/${o.id}`}>{t('sor.open')}</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
