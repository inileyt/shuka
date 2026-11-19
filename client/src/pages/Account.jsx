import { useState } from 'react';
import { patch } from '../api.js';
import { useAuth } from '../auth.jsx';
import { useI18n } from '../i18n.jsx';
import { Alert, Field, useTitle } from '../components/ui.jsx';

export default function Account() {
  const { t } = useI18n();
  useTitle(t('nav.account'));
  const { user, refresh } = useAuth();
  const [form, setForm] = useState({ name: user.name, phone: user.phone });
  const [err, setErr] = useState(null);
  const [saved, setSaved] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setErr(null); setSaved(false);
    try { await patch('/me', form); await refresh(); setSaved(true); } catch (ex) { setErr(ex); }
  };
  const f = err?.fields ?? {};
  return (
    <div className="wrap page narrow">
      <form className="form-card" onSubmit={submit} noValidate>
        <h1>{t('nav.account')}</h1>
        <p className="muted">{t('account.signedIn', { email: user.email })}</p>
        {err && !Object.keys(f).length && <Alert>{err.message}</Alert>}
        {saved && <Alert tone="success">{t('account.saved')}</Alert>}
        <Field label={t('auth.name')} error={f.name}><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
        <Field label={t('f.phone')} error={f.phone}><input inputMode="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
        <button className="btn">{t('account.save')}</button>
      </form>
    </div>
  );
}
