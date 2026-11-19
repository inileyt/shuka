import { Link } from 'react-router-dom';
import { get } from '../../api.js';
import { useI18n } from '../../i18n.jsx';
import { STATUSES } from '../../format.js';
import { Alert, useLoad, useTitle } from '../../components/ui.jsx';

export default function SellerOverview() {
  const { t, money } = useI18n();
  useTitle(t('seller.overview'));
  const [{ loading, data, error }] = useLoad(() => get('/seller/overview'), []);
  if (loading) return <p className="muted">{t('common.loading')}</p>;
  if (error) return <Alert>{error.message}</Alert>;
  return (
    <div>
      <div className="stats">
        <Link to="/seller/orders?status=placed" className="stat"><span className="stat-num">{data.toConfirm}</span><span>{t('so.toConfirm')}</span></Link>
        <Link to="/seller/orders?status=confirmed" className="stat"><span className="stat-num">{data.toShip}</span><span>{t('so.toShip')}</span></Link>
        <div className="stat"><span className="stat-num">{money(data.revenueLast30DaysAmd)}</span><span>{t('so.revenue30')}</span></div>
        <Link to="/seller/products" className="stat"><span className="stat-num">{data.productCount}</span><span>{t('seller.products')}</span></Link>
      </div>
      <h2>{t('so.byStatus')}</h2>
      <table className="table narrow-table">
        <tbody>
          {STATUSES.map((s) => (
            <tr key={s}><td><Link to={`/seller/orders?status=${s}`}>{t(`status.${s}`)}</Link></td><td className="num">{data.ordersByStatus[s]}</td></tr>
          ))}
        </tbody>
      </table>
      <p className="muted">{t('so.totalRevenue')} <strong>{money(data.revenueTotalAmd)}</strong></p>
    </div>
  );
}
