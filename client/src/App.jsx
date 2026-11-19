import { useEffect } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import { useI18n } from './i18n.jsx';
import { RequireAdmin, RequireAuth, RequireSeller } from './auth.jsx';
import Header from './components/Header.jsx';
import Home from './pages/Home.jsx';
import Search from './pages/Search.jsx';
import Product from './pages/Product.jsx';
import Cart from './pages/Cart.jsx';
import Checkout from './pages/Checkout.jsx';
import OrderPlaced from './pages/OrderPlaced.jsx';
import Orders from './pages/Orders.jsx';
import OrderDetail from './pages/OrderDetail.jsx';
import { Login, Register } from './pages/AuthPages.jsx';
import Account from './pages/Account.jsx';
import SellerActivate from './pages/SellerActivate.jsx';
import SellerLayout from './pages/seller/SellerLayout.jsx';
import SellerOverview from './pages/seller/SellerOverview.jsx';
import SellerProducts from './pages/seller/SellerProducts.jsx';
import ProductEditor from './pages/seller/ProductEditor.jsx';
import SellerOrders from './pages/seller/SellerOrders.jsx';
import SellerOrderDetail from './pages/seller/SellerOrderDetail.jsx';
import AdminLayout from './pages/admin/AdminLayout.jsx';
import AdminOverview from './pages/admin/AdminOverview.jsx';
import AdminOrders from './pages/admin/AdminOrders.jsx';
import AdminOrderDetail from './pages/admin/AdminOrderDetail.jsx';
import AdminUsers from './pages/admin/AdminUsers.jsx';

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return null;
}

function NotFound() {
  const { t } = useI18n();
  return <div className="wrap page narrow"><h1>{t('notfound.title')}</h1><p className="muted">{t('notfound.text')}</p></div>;
}

export default function App() {
  const { t } = useI18n();
  return (
    <>
      <ScrollToTop />
      <Header />
      <main className="page-wrap">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/search" element={<Search />} />
          <Route path="/products/:id" element={<Product />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/cart" element={<RequireAuth><Cart /></RequireAuth>} />
          <Route path="/checkout" element={<RequireAuth><Checkout /></RequireAuth>} />
          <Route path="/orders" element={<RequireAuth><Orders /></RequireAuth>} />
          <Route path="/orders/:id" element={<RequireAuth><OrderDetail /></RequireAuth>} />
          <Route path="/order-placed/:id" element={<RequireAuth><OrderPlaced /></RequireAuth>} />
          <Route path="/account" element={<RequireAuth><Account /></RequireAuth>} />
          <Route path="/sell" element={<RequireAuth><SellerActivate /></RequireAuth>} />
          <Route path="/seller" element={<RequireSeller><SellerLayout /></RequireSeller>}>
            <Route index element={<SellerOverview />} />
            <Route path="products" element={<SellerProducts />} />
            <Route path="products/new" element={<ProductEditor />} />
            <Route path="products/:id/edit" element={<ProductEditor />} />
            <Route path="orders" element={<SellerOrders />} />
            <Route path="orders/:id" element={<SellerOrderDetail />} />
          </Route>
          <Route path="/admin" element={<RequireAdmin><AdminLayout /></RequireAdmin>}>
            <Route index element={<AdminOverview />} />
            <Route path="orders" element={<AdminOrders />} />
            <Route path="orders/:id" element={<AdminOrderDetail />} />
            <Route path="users" element={<AdminUsers />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      <footer className="footer">
        <div className="wrap">{t('footer.text')}</div>
      </footer>
    </>
  );
}
