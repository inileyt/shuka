import { Link } from 'react-router-dom';
import { useI18n } from '../i18n.jsx';
import { Rating } from './ui.jsx';

export default function ProductCard({ p }) {
  const { t, money } = useI18n();
  return (
    <Link to={`/products/${p.id}`} className="pcard">
      <div className="pcard-img">
        {p.thumb ? <img src={p.thumb} alt="" loading="lazy" width="360" height="360" /> : <div className="noimg" />}
        {p.stock === 0 && <span className="tag-out">{t('stock.out')}</span>}
      </div>
      <div className="pcard-body">
        <h3 className="pcard-title">{p.title}</h3>
        <Rating avg={p.ratingAvg} count={p.ratingCount} />
        <div className="price">{money(p.priceAmd)}</div>
        <div className="muted small">{p.storeName}</div>
      </div>
    </Link>
  );
}
