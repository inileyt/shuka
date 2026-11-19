import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { get } from '../api.js';
import { useAuth } from '../auth.jsx';
import { LANGS, useI18n } from '../i18n.jsx';

function AccountMenu() {
  const { user, logout } = useAuth();
  const { t } = useI18n();
  const nav = useNavigate();
  const loc = useLocation();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => setOpen(false), [loc.pathname]);
  useEffect(() => {
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  if (!user) {
    return (
      <div className="account-links">
        <Link to="/login">{t('nav.logIn')}</Link>
        <Link to="/register" className="btn btn-small">{t('nav.register')}</Link>
      </div>
    );
  }
  return (
    <div className="menu" ref={ref}>
      <button className="menu-btn" aria-expanded={open} aria-haspopup="menu" onClick={() => setOpen(!open)}>
        <span className="avatar" aria-hidden="true">{user.name.slice(0, 1).toUpperCase()}</span>
        <span className="menu-name">{user.name.split(' ')[0]}</span>
      </button>
      {open && (
        <div className="menu-list" role="menu">
          <Link role="menuitem" to="/orders">{t('nav.myOrders')}</Link>
          {user.isSeller
            ? <Link role="menuitem" to="/seller">{t('nav.sellerDashboard')}</Link>
            : <Link role="menuitem" to="/sell">{t('nav.sell')}</Link>}
          {user.isAdmin && <Link role="menuitem" to="/admin">{t('nav.owner')}</Link>}
          <Link role="menuitem" to="/account">{t('nav.account')}</Link>
          <button role="menuitem" onClick={async () => { await logout(); nav('/'); }}>{t('nav.logOut')}</button>
        </div>
      )}
    </div>
  );
}

export default function Header() {
  const { user } = useAuth();
  const { t, cat, lang, setLang } = useI18n();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const loc = useLocation();
  const [q, setQ] = useState(params.get('q') ?? '');
  const [categories, setCategories] = useState([]);
  useEffect(() => { get('/categories').then((d) => setCategories(d.categories)).catch(() => {}); }, []);
  useEffect(() => { if (loc.pathname === '/search') setQ(params.get('q') ?? ''); }, [loc.pathname, params]);

  const submit = (e) => {
    e.preventDefault();
    nav(`/search${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ''}`);
  };
  const activeCat = loc.pathname === '/search' ? params.get('category') : null;
  const count = user?.cartCount ?? 0;

  return (
    <header className="header">
      <div className="awning" aria-hidden="true" />
      <div className="wrap header-row">
        <Link to="/" className="logo" aria-label={t('nav.home')}>Shuka</Link>
        <form className="search" onSubmit={submit} role="search">
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('search.placeholder')} aria-label={t('search.placeholder')} />
          <button type="submit" className="btn">{t('search.button')}</button>
        </form>
        <Link to="/cart" className="cart-link" aria-label={t('cart.aria', { n: count })}>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="9" cy="20" r="1.5" /><circle cx="18" cy="20" r="1.5" /><path d="M2 3h3l2.7 12.4a1 1 0 0 0 1 .8h8.8a1 1 0 0 0 1-.76L20 7H6" />
          </svg>
          {count > 0 && <span className="badge-count">{count}</span>}
        </Link>
        <div className="lang" role="group" aria-label={t('lang.label')}>
          {LANGS.map(([code, label]) => (
            <button key={code} type="button" lang={code} className={code === lang ? 'on' : ''} aria-pressed={code === lang} onClick={() => setLang(code)}>{label}</button>
          ))}
        </div>
        <AccountMenu />
      </div>
      <nav className="wrap cat-nav" aria-label={t('nav.categories')}>
        <NavLink to="/search" className={() => (loc.pathname === '/search' && !activeCat ? 'active' : '')}>{t('nav.allProducts')}</NavLink>
        {categories.map((c) => (
          <Link key={c.id} to={`/search?category=${c.slug}`} className={activeCat === c.slug ? 'active' : ''}>{cat(c.slug, c.name)}</Link>
        ))}
      </nav>
    </header>
  );
}
