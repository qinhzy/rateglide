import { currencyCodes } from '../data/currencies';
import { DEFAULTS, type ParsedMoney, type Settings } from './types';
const aliases: Record<string, string> = {
  人民币: 'CNY',
  人民幣: 'CNY',
  元人民币: 'CNY',
  美元: 'USD',
  美金: 'USD',
  美刀: 'USD',
  欧元: 'EUR',
  歐元: 'EUR',
  英镑: 'GBP',
  英鎊: 'GBP',
  港币: 'HKD',
  港幣: 'HKD',
  港元: 'HKD',
  日元: 'JPY',
  日圆: 'JPY',
  日圓: 'JPY',
  韩元: 'KRW',
  韓元: 'KRW',
  新加坡元: 'SGD',
  新币: 'SGD',
  新幣: 'SGD',
  澳元: 'AUD',
  澳币: 'AUD',
  澳幣: 'AUD',
  加元: 'CAD',
  纽元: 'NZD',
  紐元: 'NZD',
  新台币: 'TWD',
  新臺幣: 'TWD',
  台币: 'TWD',
  臺幣: 'TWD',
  澳门元: 'MOP',
  澳門元: 'MOP',
  泰铢: 'THB',
  泰銖: 'THB',
  卢布: 'RUB',
  盧布: 'RUB',
  卢比: 'INR',
  盧比: 'INR',
  瑞士法郎: 'CHF',
  越南盾: 'VND',
  马币: 'MYR',
  馬幣: 'MYR',
  令吉: 'MYR',
  印尼盾: 'IDR',
  菲律宾比索: 'PHP',
  土耳其里拉: 'TRY',
  南非兰特: 'ZAR',
  巴西雷亚尔: 'BRL',
};
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
  text = text.trim();
  let mult = 1;
  const suffix = text.match(/(万|萬|亿|億|千|[kKmM]|bn)\s*$/);
  if (suffix) {
    mult = (
      { 万: 1e4, 萬: 1e4, 亿: 1e8, 億: 1e8, 千: 1e3, k: 1e3, m: 1e6, bn: 1e9 } as Record<
        string,
        number
      >
    )[suffix[1].toLowerCase()];
    text = text.slice(0, suffix.index).trim();
  }
  const amount = parseNumber(text);
  if (amount === null || Math.abs(amount * mult) > 1e12) return null;
  return { amount: amount * mult, currency: found[0], raw, ambiguous, hint };
}
