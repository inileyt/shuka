import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { get, qs } from '../../api.js';
import { useI18n } from '../../i18n.jsx';
import { STATUSES } from '../../format.js';
import { Alert, Pagination, StatusBadge, useLoad, useTitle } from '../../components/ui.jsx';

export default function AdminOrders() {
  const { t, dateTime, money, region } = useI18n();
  useTitle(t('adm.allOrders'));
  const [params, setParams] = useSearchParams();
  const status = params.get('status') ?? '';
  const q = params.get('q') ?? '';
  const page = Number(params.get('page') ?? 1) || 1;
  const [text, setText] = useState(q);
  useEffect(() => setText(q), [q]);
  const [{ loading, data, error }] = useLoad(() => get(`/admin/orders${qs({ status, q, page })}`), [status, q, page]);
  const set = (changes) => { const n = new URLSearchParams(params); for (const [k, v] of Object.entries({ page: '', ...changes })) (v ? n.set(k, v) : n.delete(k)); setParams(n); };
  const hrefFor = (n) => { const x = new URLSearchParams(params); n > 1 ? x.set('page', n) : x.delete('page'); return `/admin/orders?${x}`; };

  return (
    <div>
      <div className="row-between wrap-mobile">
        <h2>{t('adm.allOrders')} {data && <span className="muted small">({data.total})</span>}</h2>
        <form className="search" onSubmit={(e) => { e.preventDefault(); set({ q: text.trim() }); }} role="search">
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder={t('adm.searchOrders')} aria-label={t('adm.searchOrders')} />
          <button className="btn">{t('search.button')}</button>
        </form>
      </div>
      <div className="tabs tabs-status">
        <button className={!status ? 'active' : ''} onClick={() => set({ status: '' })}>{t('adm.all')}</button>
        {STATUSES.map((s) => <button key={s} className={status === s ? 'active' : ''} onClick={() => set({ status: s })}>{t(`status.${s}`)}</button>)}
      </div>
      <Alert>{error?.message}</Alert>
      {loading && !data && <p className="muted">{t('common.loading')}</p>}
      {data && data.orders.length === 0 && <div className="empty"><p className="muted">{t('adm.noOrders')}</p></div>}
      {data && data.orders.length > 0 && (
        <div className="table-scroll"><table className="table">
          <thead><tr><th>{t('sor.order')}</th><th>{t('sor.placed')}</th><th>{t('adm.buyer')}</th><th>{t('sod.deliverTo')}</th><th>{t('adm.sellersStatus')}</th><th className="num">{t('cart.total')}</th></tr></thead>
          <tbody>{data.orders.map((o) => (
            <tr key={o.id}>
              <td><Link to={`/admin/orders/${o.id}`}>#{o.id}</Link></td>
              <td>{dateTime(o.createdAt)}</td>
              <td>{o.buyer.name}<div className="muted small">{o.buyer.email}</div></td>
              <td>{o.recipient}, {o.phone}<div className="muted small">{o.city}, {region(o.region)}</div></td>
              <td>{o.parts.map((p, i) => <div key={i} className="small">{p.storeName} <StatusBadge status={p.status} /></div>)}</td>
              <td className="num">{money(o.totalAmd)}</td>
            </tr>
          ))}</tbody>
        </table></div>
      )}
      {data && <Pagination page={data.page} pages={data.pages} hrefFor={hrefFor} />}
    </div>
  );
}
