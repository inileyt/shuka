import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { post } from '../api.js';
import { useAuth } from '../auth.jsx';
import { useI18n } from '../i18n.jsx';
import { Alert, Field, useTitle } from '../components/ui.jsx';

export default function SellerActivate() {
  const { t } = useI18n();
  useTitle(t('nav.sell'));
  const { user, refresh } = useAuth();
  const nav = useNavigate();
  const [form, setForm] = useState({ storeName: '', phone: user.phone });
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);
  if (user.isSeller) return <Navigate to="/seller" replace />;
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setErr(null);
    try { await post('/seller/activate', form); await refresh(); nav('/seller/products/new', { replace: true }); }
    catch (ex) { setErr(ex); setBusy(false); }
  };
  const f = err?.fields ?? {};
  return (
    <div className="wrap page narrow">
      <form className="form-card" onSubmit={submit} noValidate>
        <h1>{t('nav.sell')}</h1>
        <p className="muted">{t('sell.lead')}</p>
        {err && !Object.keys(f).length && <Alert>{err.message}</Alert>}
        <Field label={t('sell.storeName')} error={f.storeName}><input value={form.storeName} onChange={(e) => setForm({ ...form, storeName: e.target.value })} /></Field>
        <Field label={t('sell.phone')} error={f.phone}><input inputMode="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
        <button className="btn btn-big" disabled={busy}>{busy ? t('sell.opening') : t('sell.open')}</button>
      </form>
    </div>
  );
}
