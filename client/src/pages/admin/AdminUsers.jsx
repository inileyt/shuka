import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { get, qs } from '../../api.js';
import { useI18n } from '../../i18n.jsx';
import { Alert, Pagination, useLoad, useTitle } from '../../components/ui.jsx';

export default function AdminUsers() {
  const { t, date } = useI18n();
  useTitle(t('admin.people'));
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const page = Number(params.get('page') ?? 1) || 1;
  const [text, setText] = useState(q);
  useEffect(() => setText(q), [q]);
  const [{ loading, data, error }] = useLoad(() => get(`/admin/users${qs({ q, page })}`), [q, page]);
  const hrefFor = (n) => { const x = new URLSearchParams(params); n > 1 ? x.set('page', n) : x.delete('page'); return `/admin/users?${x}`; };
  return (
    <div>
      <div className="row-between wrap-mobile">
        <h2>{t('adm.registered')} {data && <span className="muted small">({data.total})</span>}</h2>
        <form className="search" onSubmit={(e) => { e.preventDefault(); setParams(text.trim() ? { q: text.trim() } : {}); }} role="search">
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder={t('adm.searchPeople')} aria-label={t('adm.searchPeople')} />
          <button className="btn">{t('search.button')}</button>
        </form>
      </div>
      <Alert>{error?.message}</Alert>
      {loading && !data && <p className="muted">{t('common.loading')}</p>}
      {data && data.users.length === 0 && <div className="empty"><p className="muted">{t('adm.nobody')}</p></div>}
      {data && data.users.length > 0 && (
        <div className="table-scroll"><table className="table">
          <thead><tr><th>{t('auth.name')}</th><th>{t('auth.email')}</th><th>{t('f.phone')}</th><th>{t('adm.store')}</th><th>{t('adm.registeredOn')}</th><th className="num">{t('adm.ordersPlaced')}</th><th className="num">{t('seller.products')}</th><th className="num">{t('adm.ordersReceived')}</th></tr></thead>
          <tbody>{data.users.map((u) => (
            <tr key={u.id}>
              <td>{u.name}</td><td>{u.email}</td><td>{u.phone}</td><td>{u.storeName ?? <span className="muted">—</span>}</td>
              <td>{date(u.createdAt)}</td><td className="num">{u.ordersPlaced}</td><td className="num">{u.products}</td><td className="num">{u.ordersReceived}</td>
            </tr>
          ))}</tbody>
        </table></div>
      )}
      {data && <Pagination page={data.page} pages={data.pages} hrefFor={hrefFor} />}
    </div>
  );
}
