import { Link } from 'react-router-dom';
import { get } from '../api.js';
import { useI18n } from '../i18n.jsx';
import ProductCard from '../components/ProductCard.jsx';
import { Alert, useLoad, useTitle } from '../components/ui.jsx';

export default function Home() {
  const { t, tp, cat } = useI18n();
  useTitle('');
  const [{ loading, data, error }] = useLoad(() => get('/home'), []);
  const cats = data?.categories ?? [];
  return (
    <div className="wrap page">
      <section className="hero">
        <h1>{t('home.title')}</h1>
        <p>{t('home.lead')}</p>
      </section>

      <Alert>{error?.message}</Alert>
      {loading && <p className="muted">{t('common.loading')}</p>}

      {cats.length > 0 && (
        <nav className="cat-tiles" aria-label={t('home.shopBy')}>
          {cats.map((c) => (
            <a key={c.id} href={`#cat-${c.slug}`} className="cat-tile">
              {c.image ? <img src={c.image} alt="" width="360" height="360" loading="lazy" /> : <div className="noimg" />}
              <span className="cat-tile-name">{cat(c.slug, c.name)}</span>
              <span className="cat-tile-count">{tp('products.count', c.productCount)}</span>
            </a>
          ))}
        </nav>
      )}

      {data && cats.length === 0 && <p className="muted">{t('home.empty')}</p>}

      {cats.map((c) => (
        <section key={c.id} id={`cat-${c.slug}`} className="cat-section">
          <div className="row-between">
            <h2>{cat(c.slug, c.name)}</h2>
            <Link to={`/search?category=${c.slug}`}>{t('home.seeAll', { n: c.productCount })}</Link>
          </div>
          <div className="grid grid-4">{c.items.map((p) => <ProductCard key={p.id} p={p} />)}</div>
        </section>
      ))}
    </div>
  );
}
