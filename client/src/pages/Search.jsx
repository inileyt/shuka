import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { get, qs } from '../api.js';
import { useI18n } from '../i18n.jsx';
import ProductCard from '../components/ProductCard.jsx';
import { Alert, Pagination, useLoad, useTitle } from '../components/ui.jsx';

const SORTS = ['newest', 'price_asc', 'price_desc', 'rating'];

export default function Search() {
  const { t, tp, cat } = useI18n();
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const category = params.get('category') ?? '';
  const sort = params.get('sort') ?? 'newest';
  const page = Number(params.get('page') ?? 1) || 1;
  const minPrice = params.get('minPrice') ?? '';
  const maxPrice = params.get('maxPrice') ?? '';
  useTitle(q ? t('search.titleQ', { q }) : t('search.allProducts'));

  // Filters and sort live in the URL, so a search can be shared.
  const [min, setMin] = useState(minPrice);
  const [max, setMax] = useState(maxPrice);
  useEffect(() => { setMin(minPrice); setMax(maxPrice); }, [minPrice, maxPrice]);

  const [cats] = useLoad(() => get('/categories'), []);
  const [{ loading, data, error }] = useLoad(() => get(`/products${qs({ q, category, sort, page, minPrice, maxPrice })}`), [q, category, sort, page, minPrice, maxPrice]);

  const update = (changes) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries({ page: '', ...changes })) (v ? next.set(k, v) : next.delete(k));
    if (next.get('sort') === 'newest') next.delete('sort');
    setParams(next);
  };
  const hrefFor = (n) => { const next = new URLSearchParams(params); n > 1 ? next.set('page', n) : next.delete('page'); return `/search?${next}`; };
  const current = cats.data?.categories.find((c) => c.slug === category);

  return (
    <div className="wrap page">
      <div className="search-layout">
        <aside className="filters" aria-label={t('search.filters')}>
          <h2 className="h-small">{t('search.filters')}</h2>
          <label className="field">
            <span className="field-label">{t('search.category')}</span>
            <select value={category} onChange={(e) => update({ category: e.target.value })}>
              <option value="">{t('search.allCategories')}</option>
              {cats.data?.categories.map((c) => <option key={c.id} value={c.slug}>{cat(c.slug, c.name)}</option>)}
            </select>
          </label>
          <form onSubmit={(e) => { e.preventDefault(); update({ minPrice: min, maxPrice: max }); }}>
            <div className="field-label">{t('search.price')}</div>
            <div className="price-range">
              <input type="number" min="0" inputMode="numeric" placeholder={t('search.from')} aria-label={t('search.from')} value={min} onChange={(e) => setMin(e.target.value)} />
              <span aria-hidden="true">–</span>
              <input type="number" min="0" inputMode="numeric" placeholder={t('search.to')} aria-label={t('search.to')} value={max} onChange={(e) => setMax(e.target.value)} />
            </div>
            <button className="btn btn-outline btn-small" type="submit">{t('search.apply')}</button>
          </form>
          {(category || minPrice || maxPrice || q) && <Link className="small" to="/search">{t('search.clear')}</Link>}
        </aside>

        <section>
          <div className="row-between wrap-mobile">
            <div>
              <h1 className="h-results">{q ? t('search.resultsFor', { q }) : current ? cat(current.slug, current.name) : t('search.allProducts')}</h1>
              <p className="muted" aria-live="polite">{data ? tp('results.count', data.total) : ' '}</p>
            </div>
            <label className="sort">
              <span className="muted small">{t('search.sortBy')}</span>
              <select value={sort} onChange={(e) => update({ sort: e.target.value })}>
                {SORTS.map((v) => <option key={v} value={v}>{t(`sort.${v}`)}</option>)}
              </select>
            </label>
          </div>
          <Alert>{error?.message}</Alert>
          {loading && !data && <p className="muted">{t('common.loading')}</p>}
          {data && data.items.length === 0 && (
            <div className="empty">
              <p><strong>{t('search.noneTitle')}</strong></p>
              <p className="muted">{t('search.noneText')}</p>
              <Link className="btn btn-outline" to="/search">{t('search.showAll')}</Link>
            </div>
          )}
          <div className="grid">{data?.items.map((p) => <ProductCard key={p.id} p={p} />)}</div>
          {data && <Pagination page={data.page} pages={data.pages} hrefFor={hrefFor} />}
        </section>
      </div>
    </div>
  );
}
