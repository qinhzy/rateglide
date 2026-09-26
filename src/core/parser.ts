import { currencyAliases, currencyCodes } from '../data/currencies';
import { DEFAULTS, type ParsedMoney, type Settings } from './types';
const aliases = currencyAliases;
const symbols: Record<string, string> = {
  US$: 'USD',
  'U.S.$': 'USD',
  HK$: 'HKD',
  CA$: 'CAD',
  C$: 'CAD',
  A$: 'AUD',
  AU$: 'AUD',
  NZ$: 'NZD',
  NT$: 'TWD',
  S$: 'SGD',
  SG$: 'SGD',
  R$: 'BRL',
  MX$: 'MXN',
  'CN¥': 'CNY',
  'JP¥': 'JPY',
  RMB: 'CNY',
  '€': 'EUR',
  '£': 'GBP',
  '₩': 'KRW',
  '₹': 'INR',
  '₽': 'RUB',
  '฿': 'THB',
  '₫': 'VND',
  '₱': 'PHP',
  '₺': 'TRY',
  '₪': 'ILS',
  '₴': 'UAH',
  '₦': 'NGN',
};
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const aliasRE = new RegExp(
  Object.keys(aliases)
    .sort((a, b) => b.length - a.length)
    .map(escape)
    .join('|'),
  'g',
);
const symbolRE = new RegExp(
  Object.keys(symbols)
    .sort((a, b) => b.length - a.length)
    .map(escape)
    .join('|'),
  'gi',
);
export function normalizeDigits(s: string) {
  return s
    .normalize('NFKC')
    .replace(/[٠-٩]/g, (x) => String(x.charCodeAt(0) - 1632))
    .replace(/[۰-۹]/g, (x) => String(x.charCodeAt(0) - 1776))
    .replace(/٫/g, '.')
    .replace(/٬/g, ',')
    .replace(/−/g, '-');
}
export function parseNumber(raw: string): number | null {
  let s = normalizeDigits(raw).trim();
  if (!s || s.length > 60) return null;
  let negative = false;
  if (/^\(.*\)$/.test(s)) {
    negative = true;
    s = s.slice(1, -1).trim();
  }
  if (!/^[+-]?[\d.,'’\s]+$/.test(s)) return null;
  if (/[0-9]['’\s]+[0-9]/.test(s) && !/^[+-]?\d{1,3}(?:['’\s]+\d{3})+(?:[.,]\d{1,6})?$/.test(s))
    return null;
  s = s.replace(/['’\s]/g, '');
  const comma = s.lastIndexOf(','),
    dot = s.lastIndexOf('.');
  if (comma >= 0 && dot >= 0) {
    const dec = comma > dot ? ',' : '.',
      group = dec === ',' ? '.' : ',';
    const parts = s.split(dec);
    if (parts.length !== 2 || !/^\d{1,6}$/.test(parts[1])) return null;
    const int = parts[0];
    const g = escape(group);
    if (!new RegExp(`^[+-]?\\d{1,3}(?:${g}\\d{3})+$`).test(int)) return null;
    s = int.split(group).join('') + '.' + parts[1];
  } else if (comma >= 0) {
    if (/^[+-]?\d{1,3}(,\d{3})+$/.test(s) || /^[+-]?\d{1,2}(,\d{2})*,\d{3}$/.test(s))
      s = s.replace(/,/g, '');
    else if (/^[+-]?\d+,\d{1,6}$/.test(s)) s = s.replace(',', '.');
    else return null;
  } else if ((s.match(/\./g) || []).length > 1) {
    if (/^[+-]?\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
    else return null;
  }
  if (!/^[+-]?\d*(?:\.\d{1,6})?$/.test(s) || !/[0-9]/.test(s)) return null;
  const n = Number(s) * (negative ? -1 : 1);
  return Number.isFinite(n) && Math.abs(n) <= 1e12 ? n : null;
}
export function parseMoney(raw: string, settings: Settings = DEFAULTS): ParsedMoney | null {
  if (!raw || raw.length > 120) return null;
  let text = normalizeDigits(raw).trim();
  if (!/\d/.test(text) || /[\n\r]/.test(text)) return null;
  const found: string[] = [];
  text = text.replace(aliasRE, (m) => {
    found.push(aliases[m]);
    return '\u0001';
  });
  text = text.replace(symbolRE, (m) => {
    found.push(symbols[Object.keys(symbols).find((k) => k.toLowerCase() === m.toLowerCase())!]);
    return '\u0001';
  });
  text = text.replace(/[A-Za-z]{3}/g, (m) => {
    if (currencyCodes.has(m.toUpperCase())) {
      found.push(m.toUpperCase());
      return '\u0001';
    }
    return m;
  });
  let ambiguous = false;
  let hint: string | undefined;
  if (text.includes('$')) {
    if (!found.length) {
      found.push(settings.defaultDollar);
      ambiguous = true;
      hint = `$ 按 ${settings.defaultDollar} 识别，可修改币种`;
    }
    text = text.replace(/\$/g, '\u0001');
  }
  if (text.includes('¥')) {
    if (!found.length) {
      found.push(settings.defaultYen);
      ambiguous = true;
      hint = `¥ 按 ${settings.defaultYen} 识别，可修改币种`;
    }
    text = text.replace(/¥/g, '\u0001');
  }
  if (text.includes('元')) {
    if (!found.length) {
      found.push('CNY');
      ambiguous = true;
      hint = '元 按人民币识别，可修改币种';
    }
    text = text.replace(/元/g, '\u0001');
  }
  if (new Set(found).size > 1 || /[\d.,]\s*\u0001+\s*[+\-\d]/.test(text)) return null;
  text = text.replace(/\u0001/g, ' ').trim();
  if (!found.length) {
    if (!settings.numbersOnly) return null;
    found.push(settings.defaultCurrency);
    ambiguous = true;
    hint = `未包含货币符号，按 ${settings.defaultCurrency} 识别`;
  }
  const amount = parseAmount(text);
  if (amount === null) return null;
  return { amount, currency: found[0], raw, ambiguous, hint };
}
const multipliers: Record<string, number> = {
  万: 1e4,
  萬: 1e4,
  亿: 1e8,
  億: 1e8,
  千: 1e3,
  k: 1e3,
  m: 1e6,
  bn: 1e9,
};
/** A number with an optional k / m / bn / 千 / 万 / 亿 multiplier, such as 2.5k or 1.2万. */
export function parseAmount(raw: string): number | null {
  let text = normalizeDigits(raw).trim();
  let mult = 1;
  const suffix = text.match(/(万|萬|亿|億|千|[km]|bn)\s*$/i);
  if (suffix) {
    mult = multipliers[suffix[1].toLowerCase()];
    text = text.slice(0, suffix.index).trim();
  }
  const amount = parseNumber(text);
  if (amount === null || Math.abs(amount * mult) > 1e12) return null;
  // Round away binary noise such as 1.1 * 1e3 = 1100.0000000000002.
  return mult === 1 ? amount : Number((amount * mult).toPrecision(15));
}
