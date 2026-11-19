import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import { useI18n } from '../i18n.jsx';
import { Alert, Field, useTitle } from '../components/ui.jsx';

const safeNext = (n) => (n && n.startsWith('/') && !n.startsWith('//') ? n : '/');

export function Login() {
  const { t } = useI18n();
  useTitle(t('auth.login'));
  const { login } = useAuth();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const [form, setForm] = useState({ email: '', password: '' });
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setErr(null);
    try { await login(form.email, form.password); nav(safeNext(params.get('next')), { replace: true }); }
    catch (ex) { setErr(ex.message); setBusy(false); }
  };
  return (
    <div className="wrap page narrow">
      <form className="form-card" onSubmit={submit}>
        <h1>{t('auth.login')}</h1>
        <Alert>{err}</Alert>
        <Field label={t('auth.email')}><input type="email" autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></Field>
        <Field label={t('auth.password')}><input type="password" autoComplete="current-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required /></Field>
        <button className="btn btn-big" disabled={busy}>{busy ? t('auth.loggingIn') : t('auth.login')}</button>
        <p className="muted">{t('auth.newHere')} <Link to={`/register${params.get('next') ? `?next=${encodeURIComponent(params.get('next'))}` : ''}`}>{t('auth.createLink')}</Link></p>
      </form>
    </div>
  );
}

export function Register() {
  const { t } = useI18n();
  useTitle(t('nav.register'));
  const { register } = useAuth();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const [form, setForm] = useState({ email: '', password: '', name: '', phone: '' });
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setErr(null);
    try { await register(form); nav(safeNext(params.get('next')), { replace: true }); }
    catch (ex) { setErr(ex); setBusy(false); }
  };
  const f = err?.fields ?? {};
  return (
    <div className="wrap page narrow">
      <form className="form-card" onSubmit={submit} noValidate>
        <h1>{t('auth.registerTitle')}</h1>
        {err && !Object.keys(f).length && <Alert>{err.message}</Alert>}
        <Field label={t('auth.name')} error={f.name}><input autoComplete="name" value={form.name} onChange={set('name')} /></Field>
        <Field label={t('auth.email')} error={f.email}><input type="email" autoComplete="email" value={form.email} onChange={set('email')} /></Field>
        <Field label={t('f.phone')} error={f.phone} hint={t('auth.phoneHint')}><input inputMode="tel" autoComplete="tel" value={form.phone} onChange={set('phone')} /></Field>
        <Field label={t('auth.password')} error={f.password} hint={t('auth.passwordHint')}><input type="password" autoComplete="new-password" value={form.password} onChange={set('password')} /></Field>
        <button className="btn btn-big" disabled={busy}>{busy ? t('auth.creating') : t('auth.create')}</button>
        <p className="muted">{t('auth.haveAccount')} <Link to="/login">{t('auth.login')}</Link></p>
      </form>
    </div>
  );
}
