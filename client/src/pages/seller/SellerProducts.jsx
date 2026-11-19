import { useState } from 'react';
import { Link } from 'react-router-dom';
import { get, patch } from '../../api.js';
import { useI18n } from '../../i18n.jsx';
import { Alert, useLoad, useTitle } from '../../components/ui.jsx';

export default function SellerProducts() {
  const { t, money } = useI18n();
  useTitle(t('seller.products'));
  const [{ loading, data, error }, setData] = useLoad(() => get('/seller/products'), []);
  const [err, setErr] = useState(null);

  const toggle = async (p) => {
    setErr(null);
    try {
      await patch(`/seller/products/${p.id}`, { isPublished: !p.isPublished });
      setData(await get('/seller/products'));
    } catch (e) { setErr(e.fields?.images || e.message); }
  };

  return (
    <div>
      <div className="row-between">
        <h2>{t('seller.products')}</h2>
        <Link className="btn" to="/seller/products/new">{t('sp.add')}</Link>
      </div>
      <Alert>{error?.message || err}</Alert>
      {loading && <p className="muted">{t('common.loading')}</p>}
      {data && data.products.length === 0 && <div className="empty"><p><strong>{t('sp.none')}</strong></p><Link className="btn" to="/seller/products/new">{t('sp.addFirst')}</Link></div>}
      {data && data.products.length > 0 && (
        <div className="table-scroll">
          <table className="table">
            <thead><tr><th></th><th>{t('pe.title')}</th><th className="num">{t('sp.price')}</th><th className="num">{t('pe.stock')}</th><th>{t('sor.status')}</th><th className="num">{t('sp.sold')}</th><th></th></tr></thead>
            <tbody>
              {data.products.map((p) => (
                <tr key={p.id}>
                  <td className="thumb-cell">{p.thumb ? <img src={p.thumb} alt="" width="48" height="48" /> : null}</td>
                  <td><Link to={`/products/${p.id}`}>{p.title}</Link></td>
                  <td className="num">{money(p.priceAmd)}</td>
                  <td className="num">{p.stock}</td>
                  <td>{p.isPublished ? <span className="status status-delivered">{t('sp.published')}</span> : <span className="status status-cancelled">{t('sp.unpublished')}</span>}</td>
                  <td className="num">{p.unitsSold}</td>
                  <td className="actions-cell">
                    <Link className="btn btn-outline btn-small" to={`/seller/products/${p.id}/edit`}>{t('sp.edit')}</Link>{' '}
                    <button className="btn btn-outline btn-small" onClick={() => toggle(p)}>{p.isPublished ? t('sp.unpublish') : t('sp.publish')}</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
