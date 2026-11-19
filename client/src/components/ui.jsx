import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '../i18n.jsx';

export function useTitle(title) {
  useEffect(() => { document.title = title ? `${title} · Shuka` : 'Shuka'; }, [title]);
}

export function Stars({ value }) {
  return <span className="stars" style={{ '--pct': `${(value / 5) * 100}%` }} aria-hidden="true">★★★★★</span>;
}

export function Rating({ avg, count }) {
  const { t } = useI18n();
  if (!count) return <div className="rating muted small">{t('rating.none')}</div>;
  return (
    <div className="rating" aria-label={t('rating.aria', { avg: avg.toFixed(1), count })}>
      <Stars value={avg} /> <span className="small">{avg.toFixed(1)}</span> <span className="muted small">({count})</span>
    </div>
  );
}

export function StarInput({ value, onChange }) {
  const { t, tp } = useI18n();
  return (
    <div className="star-input" role="radiogroup" aria-label={t('rating.label')}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" role="radio" aria-checked={value === n} aria-label={tp('rating.stars', n)}
          className={n <= value ? 'on' : ''} onClick={() => onChange(n)}>★</button>
      ))}
    </div>
  );
}

// Text that comes from the server is English: it is translated here, in one place.
export function FieldError({ children }) {
  const { tm } = useI18n();
  return children ? <p className="field-error" role="alert">{tm(children)}</p> : null;
}

export function Field({ label, error, hint, children }) {
  return (
    <label className={`field ${error ? 'has-error' : ''}`}>
      <span className="field-label">{label}</span>
      {children}
      {hint && !error && <span className="hint">{hint}</span>}
      <FieldError>{error}</FieldError>
    </label>
  );
}

export function Alert({ tone = 'error', children }) {
  const { tm } = useI18n();
  if (!children) return null;
  return <div className={`alert alert-${tone}`} role={tone === 'error' ? 'alert' : 'status'}>{typeof children === 'string' ? tm(children) : children}</div>;
}

export function StatusBadge({ status }) {
  const { t } = useI18n();
  return <span className={`status status-${status}`}>{t(`status.${status}`)}</span>;
}

export function StatusHistory({ history }) {
  const { t, dateTime } = useI18n();
  return (
    <ol className="history">
      {history.map((h, i) => (
        <li key={i}>
          <strong>{t(`status.${h.to}`)}</strong>
          <span className="muted small">{dateTime(h.at)}</span>
        </li>
      ))}
    </ol>
  );
}

export function Stepper({ value, min = 1, max, onChange, disabled }) {
  const { t } = useI18n();
  const clamp = (n) => Math.max(min, Math.min(max ?? 999, n));
  return (
    <div className="stepper">
      <button type="button" aria-label={t('qty.less')} disabled={disabled || value <= min} onClick={() => onChange(clamp(value - 1))}>−</button>
      <input type="number" inputMode="numeric" min={min} max={max} value={value} disabled={disabled} aria-label={t('qty.label')}
        onChange={(e) => { const n = parseInt(e.target.value, 10); if (Number.isFinite(n)) onChange(clamp(n)); }} />
      <button type="button" aria-label={t('qty.more')} disabled={disabled || (max !== undefined && value >= max)} onClick={() => onChange(clamp(value + 1))}>+</button>
    </div>
  );
}

export function Pagination({ page, pages, hrefFor }) {
  const { t } = useI18n();
  if (pages <= 1) return null;
  const nums = [];
  for (let n = 1; n <= pages; n++) if (n === 1 || n === pages || Math.abs(n - page) <= 1) nums.push(n);
  return (
    <nav className="pagination" aria-label={t('pagination.label')}>
      {page > 1 && <Link to={hrefFor(page - 1)}>{t('pagination.prev')}</Link>}
      {nums.map((n, i) => (
        <span key={n}>
          {i > 0 && n - nums[i - 1] > 1 && <span className="muted">…</span>}
          <Link to={hrefFor(n)} aria-current={n === page ? 'page' : undefined} className={n === page ? 'current' : ''}>{n}</Link>
        </span>
      ))}
      {page < pages && <Link to={hrefFor(page + 1)}>{t('pagination.next')}</Link>}
    </nav>
  );
}

// Loads data for a page and exposes loading / error state.
export function useLoad(fn, deps) {
  const [state, setState] = useState({ loading: true, data: null, error: null });
  useEffect(() => {
    let live = true;
    setState((s) => ({ ...s, loading: true, error: null }));
    fn().then((data) => live && setState({ loading: false, data, error: null }))
      .catch((error) => live && setState({ loading: false, data: null, error }));
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return [state, (data) => setState((s) => ({ ...s, data }))];
}
