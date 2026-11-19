import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, del, get, patch } from '../../api.js';
import { useI18n } from '../../i18n.jsx';
import { Alert, Field, FieldError, useLoad, useTitle } from '../../components/ui.jsx';

const MAX_IMAGES = 5;
const MAX_MB = 5;
const TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export default function ProductEditor() {
  const { t, tm, cat } = useI18n();
  const { id } = useParams();
  const editing = Boolean(id);
  useTitle(editing ? t('pe.edit') : t('pe.add'));
  const nav = useNavigate();
  const fileInput = useRef(null);
  const [cats] = useLoad(() => get('/categories'), []);
  const [loaded] = useLoad(() => (editing ? get(`/seller/products/${id}`) : Promise.resolve(null)), [id]);

  const [form, setForm] = useState({ title: '', categoryId: '', description: '', price: '', stock: '', isPublished: true });
  const [pending, setPending] = useState([]);   // new product: files chosen but not uploaded yet
  const [images, setImages] = useState([]);     // existing product: images stored on the server
  const [fields, setFields] = useState({});
  const [message, setMessage] = useState(null);
  const [busy, setBusy] = useState(false);

  // An error message for a bad file, or null.
  const badFile = (f) => (!TYPES.includes(f.type) ? t('pe.err.type', { name: f.name }) : f.size > MAX_MB * 1024 * 1024 ? t('pe.err.size', { name: f.name, mb: MAX_MB }) : null);

  useEffect(() => {
    const p = loaded.data?.product;
    if (!p) return;
    setForm({ title: p.title, categoryId: String(p.categoryId), description: p.description, price: String(p.priceAmd), stock: String(p.stock), isPublished: p.isPublished });
    setImages(p.images);
  }, [loaded.data]);
  useEffect(() => () => pending.forEach((x) => URL.revokeObjectURL(x.url)), []); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  const fail = (err) => { setFields(err.fields ?? {}); setMessage({ tone: 'error', text: Object.keys(err.fields ?? {}).length ? 'Check the highlighted fields.' : err.message }); };

  const pick = async (e) => {
    const files = [...e.target.files];
    e.target.value = '';
    setFields((f) => ({ ...f, images: undefined }));
    const have = editing ? images.length : pending.length;
    if (have + files.length > MAX_IMAGES) return setFields((f) => ({ ...f, images: t('pe.err.max', { max: MAX_IMAGES }) }));
    const bad = files.map(badFile).find(Boolean);
    if (bad) return setFields((f) => ({ ...f, images: bad }));
    if (!editing) return setPending((p) => [...p, ...files.map((file) => ({ file, url: URL.createObjectURL(file) }))]);
    setBusy(true);
    try {
      const fd = new FormData();
      files.forEach((f) => fd.append('images', f));
      setImages((await api('POST', `/seller/products/${id}/images`, { form: fd })).product.images);
    } catch (err) { fail(err); } finally { setBusy(false); }
  };

  const makeMainNew = (i) => setPending((p) => [p[i], ...p.filter((_, j) => j !== i)]);
  const removeNew = (i) => setPending((p) => { URL.revokeObjectURL(p[i].url); return p.filter((_, j) => j !== i); });
  const makeMainSaved = async (imgId) => { try { setImages((await patch(`/seller/products/${id}`, { mainImageId: imgId })).product.images); } catch (err) { fail(err); } };
  const removeSaved = async (imgId) => { try { setImages((await del(`/seller/products/${id}/images/${imgId}`)).product.images); setFields({}); } catch (err) { fail(err); } };

  const save = async (e) => {
    e.preventDefault();
    setBusy(true); setMessage(null); setFields({});
    try {
      if (editing) {
        await patch(`/seller/products/${id}`, { title: form.title, categoryId: form.categoryId, description: form.description, price: form.price, stock: form.stock, isPublished: form.isPublished });
        setMessage({ tone: 'success', text: t('pe.saved') });
      } else {
        if (pending.length === 0) { setFields({ images: 'Add at least one image.' }); setMessage({ tone: 'error', text: 'Check the highlighted fields.' }); setBusy(false); return; }
        const fd = new FormData();
        for (const [k, v] of Object.entries(form)) fd.append(k, String(v));
        pending.forEach((x) => fd.append('images', x.file));
        await api('POST', '/seller/products', { form: fd });
        nav('/seller/products');
        return;
      }
    } catch (err) { fail(err); }
    setBusy(false);
  };

  if (editing && loaded.loading) return <p className="muted">{t('common.loading')}</p>;
  if (editing && loaded.error) return <div><Alert>{loaded.error.message}</Alert><Link to="/seller/products">{t('pe.back')}</Link></div>;
  const count = editing ? images.length : pending.length;

  return (
    <form className="editor" onSubmit={save} noValidate>
      <p className="crumbs small"><Link to="/seller/products">{t('seller.products')}</Link> / {editing ? t('pe.editShort') : t('pe.newShort')}</p>
      <h2>{editing ? t('pe.edit') : t('pe.add')}</h2>
      {message && <Alert tone={message.tone}>{message.tone === 'error' ? tm(message.text) : message.text}</Alert>}

      <Field label={t('pe.title')} error={fields.title}><input value={form.title} onChange={set('title')} maxLength="120" /></Field>
      <Field label={t('search.category')} error={fields.categoryId}>
        <select value={form.categoryId} onChange={set('categoryId')}>
          <option value="">{t('pe.chooseCat')}</option>
          {cats.data?.categories.map((c) => <option key={c.id} value={c.id}>{cat(c.slug, c.name)}</option>)}
        </select>
      </Field>
      <Field label={t('product.description')} error={fields.description}><textarea rows="6" value={form.description} onChange={set('description')} maxLength="5000" /></Field>
      <div className="form-grid">
        <Field label={t('pe.price')} error={fields.price} hint={t('pe.priceHint')}><input type="number" min="1" inputMode="numeric" value={form.price} onChange={set('price')} /></Field>
        <Field label={t('pe.stock')} error={fields.stock} hint={t('pe.stockHint')}><input type="number" min="0" inputMode="numeric" value={form.stock} onChange={set('stock')} /></Field>
      </div>

      <div className="field">
        <span className="field-label">{t('pe.images', { n: count, max: MAX_IMAGES })}</span>
        <span className="hint">{t('pe.imagesHint', { mb: MAX_MB })}</span>
        <ul className="img-grid">
          {editing
            ? images.map((im, i) => (
              <li key={im.id}>
                <img src={im.thumb} alt="" width="120" height="120" />
                {i === 0 ? <span className="main-tag">{t('pe.main')}</span> : <button type="button" className="link-btn" onClick={() => makeMainSaved(im.id)}>{t('pe.makeMain')}</button>}
                <button type="button" className="link-btn danger" onClick={() => removeSaved(im.id)}>{t('cart.remove')}</button>
              </li>
            ))
            : pending.map((x, i) => (
              <li key={x.url}>
                <img src={x.url} alt="" width="120" height="120" />
                {i === 0 ? <span className="main-tag">{t('pe.main')}</span> : <button type="button" className="link-btn" onClick={() => makeMainNew(i)}>{t('pe.makeMain')}</button>}
                <button type="button" className="link-btn danger" onClick={() => removeNew(i)}>{t('cart.remove')}</button>
              </li>
            ))}
        </ul>
        {count < MAX_IMAGES && (
          <div>
            <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={pick} />
            <button type="button" className="btn btn-outline btn-small" disabled={busy} onClick={() => fileInput.current.click()}>{editing ? t('pe.upload') : t('pe.choose')}</button>
          </div>
        )}
        <FieldError>{fields.images}</FieldError>
      </div>

      <label className="check"><input type="checkbox" checked={form.isPublished} onChange={set('isPublished')} /> {t('pe.published')}</label>
      <p className="actions">
        <button className="btn btn-big" disabled={busy}>{busy ? t('pe.saving') : editing ? t('account.save') : t('pe.addProduct')}</button>
        <Link className="btn btn-outline" to="/seller/products">{t('pe.back')}</Link>
      </p>
    </form>
  );
}
