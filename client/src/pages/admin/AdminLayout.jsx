import { NavLink, Outlet } from 'react-router-dom';
import { useI18n } from '../../i18n.jsx';

export default function AdminLayout() {
  const { t } = useI18n();
  return (
    <div className="wrap page">
      <div className="seller-head">
        <div><p className="muted small">{t('admin.readonly')}</p><h1 className="h-store">Shuka</h1></div>
        <nav className="tabs" aria-label={t('nav.owner')}>
          <NavLink to="/admin" end>{t('seller.overview')}</NavLink>
          <NavLink to="/admin/orders">{t('seller.orders')}</NavLink>
          <NavLink to="/admin/users">{t('admin.people')}</NavLink>
        </nav>
      </div>
      <Outlet />
    </div>
  );
}
