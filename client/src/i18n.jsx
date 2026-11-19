import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import en from './locales/en.js';
import hy from './locales/hy.js';
import ru from './locales/ru.js';

const DICTS = { en, hy, ru };
export const LANGS = [['hy', 'Հայ'], ['ru', 'Рус'], ['en', 'EN']];
const LOCALE = { hy: 'hy-AM', ru: 'ru-RU', en: 'en-GB' };
const STORE_KEY = 'shuka_lang';

function initialLang() {
  try {
    const saved = localStorage.getItem(STORE_KEY);
    if (DICTS[saved]) return saved;
  } catch { /* storage can be blocked */ }
  return 'hy'; // the shop is made for Armenia
}

const I18nContext = createContext(null);
export const useI18n = () => useContext(I18nContext);

export function I18nProvider({ children }) {
  const [lang, setLangState] = useState(initialLang);
  useEffect(() => { document.documentElement.lang = lang; }, [lang]);
  const setLang = useCallback((l) => {
    if (!DICTS[l]) return;
    setLangState(l);
    try { localStorage.setItem(STORE_KEY, l); } catch { /* ignore */ }
  }, []);

  const value = useMemo(() => {
    const dict = DICTS[lang];
    const locale = LOCALE[lang];
    const plural = new Intl.PluralRules(locale);
    const fill = (s, vars) => (vars ? s.replace(/\{(\w+)\}/g, (_, k) => (vars[k] !== undefined ? vars[k] : `{${k}}`)) : s);
    const t = (key, vars) => fill(dict.ui[key] ?? en.ui[key] ?? key, vars);
    // Plural forms: key_one, key_few, key_many, key_other (as the language needs them)
    const tp = (key, n, vars) => {
      const form = plural.select(n);
      const s = dict.ui[`${key}_${form}`] ?? dict.ui[`${key}_other`] ?? en.ui[`${key}_${form}`] ?? en.ui[`${key}_other`] ?? key;
      return fill(s, { n: n.toLocaleString(locale), ...vars });
    };
    // Messages that come from the server are in English. They are mapped here.
    const tm = (msg) => {
      if (typeof msg !== 'string' || lang === 'en') return msg;
      if (dict.server[msg]) return dict.server[msg];
      const mv = msg.match(/^An order that is (\w+) cannot move to (\w+)\.$/);
      if (mv) return t('err.move', { from: t(`status.${mv[1]}`), to: t(`status.${mv[2]}`) });
      for (const [re, tpl] of dict.serverRe) {
        const m = msg.match(new RegExp(re));
        if (m) return tpl.replace(/\$(\d)/g, (_, i) => m[i] ?? '');
      }
      return msg;
    };
    const money = (n) => `${Number(n).toLocaleString(locale)} ${lang === 'en' ? 'AMD' : '֏'}`;
    const date = (iso) => new Date(iso).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' });
    const dateTime = (iso) => new Date(iso).toLocaleString(locale, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    const cat = (slug, fallback) => dict.ui[`cat.${slug}`] ?? fallback ?? slug;
    const status = (s) => t(`status.${s}`);
    const region = (r) => dict.ui[`region.${r}`] ?? r;
    const stock = (n) => (n <= 0 ? { text: t('stock.out'), tone: 'out' } : n <= 5 ? { text: t('stock.low', { n }), tone: 'low' } : { text: t('stock.ok'), tone: 'ok' });
    return { lang, setLang, t, tp, tm, money, date, dateTime, cat, status, region, stock };
  }, [lang, setLang]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}
