import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { get, post } from '../api.js';
import { useAuth } from '../auth.jsx';
import { useI18n } from '../i18n.jsx';
import { REGIONS, newKey } from '../format.js';
import { Alert, Field, useLoad, useTitle } from '../components/ui.jsx';

export default function Checkout() {
  const { t, tm, money, region } = useI18n();
  useTitle(t('checkout.title'));
  const { user, refresh } = useAuth();
  const nav = useNavigate();
  const [{ loading, data, error }] = useLoad(() => get('/cart'), []);
  const last = user.lastAddress;
  // The server stores "street, building" in one column. Split it again for the form.
  const cut = last ? last.street.lastIndexOf(', ') : -1;
  const lastStreet = last ? (cut > 0 ? last.street.slice(0, cut) : last.street) : '';
  const lastBuilding = cut > 0 ? last.street.slice(cut + 2) : '';
  // The same key is sent on every click, so a double click cannot create two orders.
  const requestKey = useRef(newKey());
  const [form, setForm] = useState({
    recipient: last?.recipient ?? user.name, phone: last?.phone ?? user.phone, region: last?.region ?? 'Yerevan',
    city: last?.city ?? '', street: lastStreet, building: lastBuilding, apartment: last?.apartment ?? '', note: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [problem, setProblem] = useState(null);
  const [fields, setFields] = useState({});
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const cart = data?.cart;

  const submit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true); setProblem(null); setFields({});
    try {
      const { order } = await post('/orders', { ...form, requestKey: requestKey.current });
      await refresh();
      nav(`/order-placed/${order.id}`, { replace: true });
    } catch (err) {
      setFields(err.fields);
      setProblem(err);
      setSubmitting(false); // unlock the button only when the order was NOT placed
    }
  };

  if (loading) return <div className="wrap page"><p className="muted">{t('common.loading')}</p></div>;
  if (error) return <div className="wrap page"><Alert>{error.message}</Alert></div>;
  if (!cart || cart.groups.length === 0) {
    return <div className="wrap page empty"><p><strong>{t('cart.empty')}</strong></p><Link className="btn" to="/search">{t('cart.find')}</Link></div>;
  }
  const cartProblem = ['PRICE_CHANGED', 'OUT_OF_STOCK', 'UNAVAILABLE'].includes(problem?.code);

  return (
    <div className="wrap page">
      <h1>{t('checkout.title')}</h1>
      <div className="cart-layout">
        <form onSubmit={submit} noValidate className="form-card">
          <h2 className="h-small">{t('checkout.address')}</h2>
          {problem && (
            <Alert>{tm(problem.message)} {cartProblem && <Link to="/cart">{t('checkout.backCart')}</Link>}</Alert>
          )}
          <div className="form-grid">
            <Field label={t('f.recipient')} error={fields.recipient}><input value={form.recipient} onChange={set('recipient')} autoComplete="name" /></Field>
            <Field label={t('f.phone')} error={fields.phone}><input value={form.phone} onChange={set('phone')} inputMode="tel" autoComplete="tel" /></Field>
            <Field label={t('f.region')} error={fields.region}>
              <select value={form.region} onChange={set('region')}>{REGIONS.map((r) => <option key={r} value={r}>{region(r)}</option>)}</select>
            </Field>
            <Field label={t('f.city')} error={fields.city}><input value={form.city} onChange={set('city')} autoComplete="address-level2" /></Field>
            <Field label={t('f.street')} error={fields.street}><input value={form.street} onChange={set('street')} autoComplete="address-line1" /></Field>
            <Field label={t('f.building')} error={fields.building}><input value={form.building} onChange={set('building')} /></Field>
            <Field label={t('f.apartmentOpt')} error={fields.apartment}><input value={form.apartment} onChange={set('apartment')} /></Field>
          </div>
          <Field label={t('f.noteOpt')} error={fields.note}><textarea rows="3" value={form.note} onChange={set('note')} maxLength="500" /></Field>
          {fields.requestKey && <Alert>{fields.requestKey}</Alert>}
          <p className="payline">{t('checkout.paymentLine')}</p>
          <button className="btn btn-big" type="submit" disabled={submitting}>{submitting ? t('checkout.placing') : t('checkout.place', { total: money(cart.totalAmd) })}</button>
        </form>

        <aside className="summary">
          <h2 className="h-small">{t('checkout.yourItems')}</h2>
          {cart.groups.map((g) => (
            <div key={g.sellerId} className="summary-group">
              <strong>{g.storeName}</strong>
              {g.items.map((it) => <div key={it.productId} className="summary-row small"><span>{it.quantity} × {it.title}</span><span>{money(it.priceAmd * it.quantity)}</span></div>)}
              <div className="summary-row small"><span className="muted">{t('od.subtotal')}</span><span>{money(g.subtotalAmd)}</span></div>
            </div>
          ))}
          <div className="summary-row total"><span>{t('checkout.totalToPay')}</span><strong>{money(cart.totalAmd)}</strong></div>
          <p className="muted small">{t('checkout.payNote')}</p>
        </aside>
      </div>
    </div>
  );
}
