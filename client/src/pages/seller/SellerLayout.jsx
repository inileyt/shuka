import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../../auth.jsx';
import { useI18n } from '../../i18n.jsx';

export default function SellerLayout() {
  const { user } = useAuth();
  const { t } = useI18n();
  return (
    <div className="wrap page">
      <div className="seller-head">
        <div><p className="muted small">{t('nav.sellerDashboard')}</p><h1 className="h-store">{user.storeName}</h1></div>
        <nav className="tabs" aria-label={t('nav.sellerDashboard')}>
          <NavLink to="/seller" end>{t('seller.overview')}</NavLink>
          <NavLink to="/seller/products">{t('seller.products')}</NavLink>
          <NavLink to="/seller/orders">{t('seller.orders')}</NavLink>
        </nav>
      </div>
      <Outlet />
    </div>
  );
}
