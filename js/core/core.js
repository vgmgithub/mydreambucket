// core.js (My Dream Bucket) — the money currency, as in MyNotes (Menu > App Currency): only the symbol and number
// style change, figures are never converted.
export const APP_CURRENCIES = [
  { code: 'INR', sym: '₹', locale: 'en-IN', name: 'Indian Rupee' },
  { code: 'USD', sym: '$', locale: 'en-US', name: 'US Dollar' },
  { code: 'AED', sym: 'AED ', locale: 'en-AE', name: 'UAE Dirham' },
  { code: 'SGD', sym: 'S$', locale: 'en-SG', name: 'Singapore Dollar' },
  { code: 'NZD', sym: 'NZ$', locale: 'en-NZ', name: 'New Zealand Dollar' },
  { code: 'LKR', sym: 'Rs ', locale: 'en-LK', name: 'Sri Lankan Rupee' },
];
const KEY = 'mydreambucketCurrency';
let _appCur = 'INR';
try { const c = localStorage.getItem(KEY); if (APP_CURRENCIES.some((x) => x.code === c)) _appCur = c; } catch (_) { /* storage blocked */ }
export const appCur = () => _appCur;
export const appCurInfo = () => APP_CURRENCIES.find((x) => x.code === _appCur) || APP_CURRENCIES[0];
export const curSym = () => appCurInfo().sym;
export function setAppCur(code) {
  if (!APP_CURRENCIES.some((x) => x.code === code)) return false;
  _appCur = code;
  try { localStorage.setItem(KEY, code); } catch (_) { /* storage blocked */ }
  return true;
}
const _appFmt = {};
export function appCurFmt(digits) {
  const k = _appCur + digits;
  if (!_appFmt[k]) {
    const i = appCurInfo();
    try {
      // S$, NZ$ and Rs are written in front of the grouped number, so they are never mistaken for US dollars.
      if (i.code === 'SGD' || i.code === 'NZD' || i.code === 'LKR') {
        const nf = new Intl.NumberFormat(i.locale, { minimumFractionDigits: digits, maximumFractionDigits: digits });
        _appFmt[k] = { format: (x) => { const v = Number(x) || 0; return (v < 0 ? '-' : '') + i.sym + nf.format(Math.abs(v)); } };
      } else _appFmt[k] = new Intl.NumberFormat(i.locale, { style: 'currency', currency: i.code, minimumFractionDigits: digits, maximumFractionDigits: digits });
    } catch (_) { _appFmt[k] = { format: (x) => i.sym + (Number(x) || 0).toFixed(digits) }; }
  }
  return _appFmt[k];
}
