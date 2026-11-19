import { Link } from 'react-router-dom';
import { get } from '../../api.js';
import { useI18n } from '../../i18n.jsx';
import { STATUSES } from '../../format.js';
import { Alert, useLoad, useTitle } from '../../components/ui.jsx';

export default function AdminOverview() {
  const { t, money } = useI18n();
  useTitle(t('nav.owner'));
  const [{ loading, data: d, error }] = useLoad(() => get('/admin/overview'), []);
  if (loading) return <p className="muted">{t('common.loading')}</p>;
  if (error) return <Alert>{error.message}</Alert>;
  return (
    <div>
      <div className="stats">
        <Link to="/admin/users" className="stat"><span className="stat-num">{d.users}</span><span>{t('adm.people', { n: d.newUsers7d })}</span></Link>
        <Link to="/admin/users" className="stat"><span className="stat-num">{d.sellers}</span><span>{t('adm.sellers')}</span></Link>
        <Link to="/admin/orders" className="stat"><span className="stat-num">{d.orders}</span><span>{t('adm.orders', { n: d.orders7d })}</span></Link>
        <div className="stat"><span className="stat-num">{d.products}</span><span>{t('seller.products')}</span></div>
      </div>
      <div className="stats">
        <div className="stat"><span className="stat-num">{money(d.orderedValueAmd)}</span><span>{t('adm.ordered')}</span></div>
        <div className="stat"><span className="stat-num">{money(d.deliveredValueAmd)}</span><span>{t('adm.delivered')}</span></div>
      </div>
      <h2>{t('adm.byStatus')}</h2>
      <table className="table narrow-table"><tbody>
        {STATUSES.map((s) => <tr key={s}><td><Link to={`/admin/orders?status=${s}`}>{t(`status.${s}`)}</Link></td><td className="num">{d.sellerOrdersByStatus[s]}</td></tr>)}
      </tbody></table>
      <h2>{t('adm.download')}</h2>
      <p className="actions">
        <a className="btn btn-outline" href="/api/admin/export/orders.csv">{t('adm.csvOrders')}</a>
        <a className="btn btn-outline" href="/api/admin/export/users.csv">{t('adm.csvPeople')}</a>
      </p>
      <p className="muted small">{t('adm.partsNote')}</p>
    </div>
  );
}
