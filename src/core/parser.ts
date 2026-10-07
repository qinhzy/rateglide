import { currencyAliases, currencyCodes, decimals } from '../data/currencies';
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
  AR$: 'ARS',
  RD$: 'DOP',
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
  '₸': 'KZT',
  '₾': 'GEL',
  '₼': 'AZN',
  '₡': 'CRC',
  '₲': 'PYG',
  '₵': 'GHS',
  '₮': 'MNT',
  '₭': 'LAK',
  '៛': 'KHR',
  '৳': 'BDT',
  円: 'JPY',
  원: 'KRW',
};
// Letter-based symbols count only as whole words, so “FIRM 25” is not read as ringgit.
const wordSymbols: Record<string, string> = {
  RM: 'MYR',
  Rp: 'IDR',
  zł: 'PLN',
  Kč: 'CZK',
  Ft: 'HUF',
  lei: 'RON',
  'S/': 'PEN',
  'S/.': 'PEN',
  'Fr.': 'CHF',
  'SFr.': 'CHF',
  руб: 'RUB',
  'руб.': 'RUB',
  грн: 'UAH',
  'грн.': 'UAH',
  лв: 'BGN',
  'лв.': 'BGN',
  đ: 'VND',
  đồng: 'VND',
  VNĐ: 'VND',
};
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const longestFirst = (keys: string[]) =>
  [...keys]
    .sort((a, b) => b.length - a.length)
    .map(escape)
    .join('|');
const aliasRE = new RegExp(longestFirst(Object.keys(aliases)), 'g');
const symbolRE = new RegExp(longestFirst(Object.keys(symbols)), 'gi');
// Letters of space-separated scripts. Codes and letter symbols must not touch them, so “lakh”
// holds no LAK code, while CJK text may sit right next to a price.
const letters = 'A-Za-z\\u00C0-\\u024F\\u1E00-\\u1EFF\\u0370-\\u03FF\\u0400-\\u04FF';
// A leading group stands in for a lookbehind, which older Safari versions cannot compile.
const word = (pattern: string, flags = 'g') =>
  new RegExp(`(^|[^${letters}])(${pattern})(?![${letters}])`, flags);
const wordSymbolRE = word(longestFirst(Object.keys(wordSymbols)));
const codeRE = word('[A-Za-z]{3}');
/** Where a selection came from: the page language and host settle symbols such as $ and ¥. */
export type PageContext = { lang?: string; host?: string };
/** Symbols shared by several currencies. */
export type AmbiguousSymbol = '$' | '¥' | '元' | 'kr' | 'Rs' | 'R';
const regional: Record<AmbiguousSymbol, Record<string, string>> = {
  $: {
    US: 'USD',
    CA: 'CAD',
    AU: 'AUD',
    NZ: 'NZD',
    HK: 'HKD',
    SG: 'SGD',
    TW: 'TWD',
    MX: 'MXN',
    AR: 'ARS',
    CL: 'CLP',
    CO: 'COP',
    UY: 'UYU',
    EC: 'USD',
    SV: 'USD',
    PA: 'USD',
    PR: 'USD',
  },
  '¥': { CN: 'CNY', JP: 'JPY' },
  元: { CN: 'CNY', TW: 'TWD', HK: 'HKD', MO: 'MOP' },
  kr: { SE: 'SEK', NO: 'NOK', DK: 'DKK', IS: 'ISK', FO: 'DKK', GL: 'DKK' },
  Rs: { IN: 'INR', PK: 'PKR', LK: 'LKR', NP: 'NPR', MU: 'MUR', SC: 'SCR' },
  R: { ZA: 'ZAR' },
};
// Country-code domains that are widely registered elsewhere say nothing about local prices.
const genericDomains = new Set('AC AI CC CO FM GG IM IO LA LY ME NU SH TK TO TV VC WS'.split(' '));
// Languages spoken mainly in one country, for pages whose lang attribute has no region.
const languageRegions: Record<string, string> = {
  ja: 'JP',
  zh: 'CN',
  sv: 'SE',
  nb: 'NO',
  nn: 'NO',
  no: 'NO',
  da: 'DK',
  is: 'IS',
  fo: 'FO',
  hi: 'IN',
  mr: 'IN',
  gu: 'IN',
  kn: 'IN',
  ml: 'IN',
  te: 'IN',
  pa: 'IN',
  ur: 'PK',
  si: 'LK',
  ne: 'NP',
  af: 'ZA',
  zu: 'ZA',
  xh: 'ZA',
};
function locale(lang?: string) {
  try {
    return lang ? new Intl.Locale(lang.trim().replace(/_/g, '-')) : null;
  } catch {
    return null;
  }
}
function regions(context: PageContext) {
  const found: string[] = [];
  const domain = context.host?.toUpperCase().replace(/\.$/, '').split('.').pop() ?? '';
  if (/^[A-Z]{2}$/.test(domain) && !genericDomains.has(domain)) found.push(domain);
  const tag = locale(context.lang);
  if (tag?.region) found.push(tag.region);
  // Traditional Chinese is written in both Taiwan and Hong Kong, so it settles nothing alone.
  else if (tag && tag.script !== 'Hant' && languageRegions[tag.language])
    found.push(languageRegions[tag.language]);
  return found;
}
/** The currency a shared symbol most likely means on a page, or null without a clear hint. */
export function inferCurrency(symbol: AmbiguousSymbol, context?: PageContext): string | null {
  if (!context) return null;
  for (const region of regions(context))
    if (regional[symbol][region]) return regional[symbol][region];
  return null;
}
const decimalSeparators = new Map<string, '.' | ',' | undefined>();
/** The decimal separator of a page's language, when it is a dot or a comma. */
export function decimalSeparator(lang?: string): '.' | ',' | undefined {
  const tag = locale(lang)?.toString();
  if (!tag) return undefined;
  if (!decimalSeparators.has(tag)) {
    const separator = new Intl.NumberFormat(tag)
      .formatToParts(1.5)
      .find((part) => part.type === 'decimal')?.value;
    decimalSeparators.set(tag, separator === '.' || separator === ',' ? separator : undefined);
  }
  return decimalSeparators.get(tag);
}
// Currencies priced in whole units, where “150.000” groups thousands instead of marking decimals.
const wholeUnitCurrencies = new Set('IDR COP HUF IRR LBP UZS MMK TZS SYP'.split(' '));
function wholeUnits(code: string) {
  return wholeUnitCurrencies.has(code) || decimals(code) === 0;
}
export function normalizeDigits(s: string) {
  return s
    .normalize('NFKC')
    .replace(/[٠-٩]/g, (x) => String(x.charCodeAt(0) - 1632))
    .replace(/[۰-۹]/g, (x) => String(x.charCodeAt(0) - 1776))
    .replace(/٫/g, '.')
    .replace(/٬/g, ',')
    .replace(/−/g, '-');
}
/** How to read a lone separator: whole-unit currencies and comma-decimal pages group thousands. */
export type NumberHints = { wholeUnits?: boolean; decimal?: '.' | ',' };
export function parseNumber(raw: string, hints: NumberHints = {}): number | null {
  let s = normalizeDigits(raw).trim();
  if (!s || s.length > 60) return null;
  let negative = false;
  if (/^\(.*\)$/.test(s)) {
    negative = true;
    s = s.slice(1, -1).trim();
  }
  // “1.299,-” and “12.–” mark a price without minor units.
  s = s.replace(/([.,])[-–—]{1,2}$/, '$100');
  if (!/^[+-]?[\d.,'’\s]+$/.test(s)) return null;
  if (/[0-9]['’\s]+[0-9]/.test(s) && !/^[+-]?\d{1,3}(?:['’\s]+\d{3})+(?:[.,]\d{1,6})?$/.test(s))
    return null;
  s = s.replace(/['’\s]/g, '');
  const comma = s.lastIndexOf(','),
    dot = s.lastIndexOf('.');
  const grouped = hints.wholeUnits || hints.decimal === ',';
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
    // A lone “1,789” is a decimal on comma-decimal pages unless the currency has no minor units.
    if (!hints.wholeUnits && hints.decimal === ',' && /^[+-]?\d+,\d{1,6}$/.test(s))
      s = s.replace(',', '.');
    else if (/^[+-]?\d{1,3}(,\d{3})+$/.test(s) || /^[+-]?\d{1,2}(,\d{2})*,\d{3}$/.test(s))
      s = s.replace(/,/g, '');
    else if (/^[+-]?\d+,\d{1,6}$/.test(s)) s = s.replace(',', '.');
    else return null;
  } else if ((s.match(/\./g) || []).length > 1) {
    if (/^[+-]?\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
    else return null;
  } else if (grouped && /^[+-]?\d{1,3}\.\d{3}$/.test(s)) s = s.replace('.', '');
  if (!/^[+-]?\d*(?:\.\d{1,6})?$/.test(s) || !/[0-9]/.test(s)) return null;
  const n = Number(s) * (negative ? -1 : 1);
  return Number.isFinite(n) && Math.abs(n) <= 1e12 ? n : null;
}
const fallbacks: Record<AmbiguousSymbol, (s: Settings) => string> = {
  $: (s) => s.defaultDollar,
  '¥': (s) => s.defaultYen,
  元: () => 'CNY',
  kr: () => 'SEK',
  Rs: () => 'INR',
  R: () => '',
};
export function parseMoney(
  raw: string,
  settings: Settings = DEFAULTS,
  context?: PageContext,
): ParsedMoney | null {
  if (!raw || raw.length > 120) return null;
  let text = normalizeDigits(raw).trim();
  if (!/\d/.test(text) || /[\n\r]/.test(text)) return null;
  // Notes such as “（税込）” or “(incl. VAT)” follow many prices; notes with numbers stay.
  text = text.replace(/\s*[（(][^\d（）()]{1,16}[）)]\s*$/, '');
  const page = settings.smartSymbols === false ? undefined : context;
  const found: string[] = [];
  const mark = (code: string) => {
    found.push(code);
    return '\u0001';
  };
  text = text.replace(aliasRE, (m) => mark(aliases[m]));
  text = text.replace(symbolRE, (m) =>
    mark(symbols[Object.keys(symbols).find((k) => k.toLowerCase() === m.toLowerCase())!]),
  );
  text = text.replace(
    wordSymbolRE,
    (_, before: string, symbol: string) => before + mark(wordSymbols[symbol]),
  );
  text = text.replace(codeRE, (m, before: string, code: string) =>
    currencyCodes.has(code.toUpperCase()) ? before + mark(code.toUpperCase()) : m,
  );
  // Shared symbols are read last, from the page when it gives a clear hint.
  const shared = new Set<AmbiguousSymbol>();
  const take = (symbol: AmbiguousSymbol, pattern: RegExp) => {
    text = text.replace(pattern, (_, before: unknown) => {
      shared.add(symbol);
      return (typeof before === 'string' ? before : '') + '\u0001';
    });
  };
  take('$', /\$/g);
  take('¥', /¥/g);
  take('元', /元/g);
  take('kr', word('[Kk]r\\.?'));
  take('Rs', word('Rs\\.?'));
  // A bare R is only rand on South African pages; elsewhere it stays text and fails.
  if (inferCurrency('R', page)) take('R', new RegExp(`(^|[^${letters}])R(?=\\s?[\\d.,])`, 'g'));
  // “¥899元” is yuan.
  if (shared.has('¥') && shared.has('元')) shared.delete('¥');
  let ambiguous = false;
  let hint: string | undefined;
  if (!found.length && shared.size) {
    if (shared.size > 1) return null;
    const [symbol] = shared;
    const inferred = inferCurrency(symbol, page);
    const code = inferred || fallbacks[symbol](settings);
    if (!code) return null;
    found.push(code);
    ambiguous = true;
    hint = inferred
      ? `${symbol} 按 ${code} 识别（根据网页语言或地区），可修改币种`
      : symbol === '元'
        ? '元 按人民币识别，可修改币种'
        : `${symbol} 按 ${code} 识别，可修改币种`;
  }
  if (new Set(found).size > 1 || /[\d.,]\s*\u0001+\s*[+\-\d]/.test(text)) return null;
  text = text.replace(/\u0001/g, ' ').trim();
  if (!found.length) {
    if (!settings.numbersOnly) return null;
    found.push(settings.defaultCurrency);
    ambiguous = true;
    hint = `未包含货币符号，按 ${settings.defaultCurrency} 识别`;
  }
  const amount = parseAmount(text, {
    wholeUnits: wholeUnits(found[0]),
    decimal: page ? decimalSeparator(page.lang) : undefined,
  });
  if (amount === null) return null;
  return { amount, currency: found[0], raw, ambiguous, hint };
}
const wordLetter = new RegExp(`[${letters}]`);
/**
 * A bare number read together with the currency written beside it. A double-click selects
 * only “129.00” in “$129.00”, so `before` and `after` are the characters around the selection.
 */
export function priceBeside(
  number: string,
  before: string,
  after: string,
  read: (text: string) => ParsedMoney | null,
): ParsedMoney | null {
  if (parseAmount(number) === null) return null;
  // Candidates may shorten “HK$” to “$” only at a word edge, never to “AUD” inside “BAUD”.
  const cuts = (left: string, right: string) => wordLetter.test(left) && wordLetter.test(right);
  const head = before.match(/[^\s\d.,]*\s?$/)![0];
  const tail = after.match(/^\s?[^\s\d.,]*/)![0];
  const suffixes: string[] = [];
  for (let end = tail.length; end > 0; end--)
    if (!cuts(tail[end - 1], after[end] ?? '')) suffixes.push(tail.slice(0, end));
  for (let start = 0; start < head.length; start++) {
    const at = before.length - head.length + start;
    if (cuts(before[at - 1] ?? '', before[at])) continue;
    const prefix = before.slice(at);
    // “$1.5” followed by “ million” is $1.5 million.
    for (const suffix of suffixes) {
      const money = read(prefix + number + suffix);
      if (money) return money;
    }
    const money = read(prefix + number);
    if (money) return money;
  }
  for (const suffix of suffixes) {
    const money = read(number + suffix);
    if (money) return money;
  }
  return null;
}
const multipliers: Record<string, number> = {
  k: 1e3,
  thousand: 1e3,
  千: 1e3,
  ribu: 1e3,
  rb: 1e3,
  万: 1e4,
  萬: 1e4,
  만: 1e4,
  lakh: 1e5,
  lakhs: 1e5,
  lac: 1e5,
  m: 1e6,
  mn: 1e6,
  mio: 1e6,
  million: 1e6,
  百万: 1e6,
  百萬: 1e6,
  juta: 1e6,
  jt: 1e6,
  triệu: 1e6,
  千万: 1e7,
  千萬: 1e7,
  crore: 1e7,
  crores: 1e7,
  cr: 1e7,
  亿: 1e8,
  億: 1e8,
  억: 1e8,
  b: 1e9,
  bn: 1e9,
  billion: 1e9,
  mrd: 1e9,
  tỷ: 1e9,
};
const multiplierRE = new RegExp(`(${longestFirst(Object.keys(multipliers))})\\.?\\s*$`, 'i');
/** A number with an optional multiplier, such as 2.5k, $1.5 million, 1.2万 or ₹15 lakh. */
export function parseAmount(raw: string, hints: NumberHints = {}): number | null {
  let text = normalizeDigits(raw).trim();
  let mult = 1;
  const suffix = text.match(multiplierRE);
  if (suffix) {
    mult = multipliers[suffix[1].toLowerCase()];
    text = text.slice(0, suffix.index).trim();
  }
  // Multiplied amounts such as “1,5 juta” are decimals, not groups of thousands.
  const amount = parseNumber(text, mult === 1 ? hints : { decimal: hints.decimal });
  if (amount === null || Math.abs(amount * mult) > 1e12) return null;
  // Round away binary noise such as 1.1 * 1e3 = 1100.0000000000002.
  return mult === 1 ? amount : Number((amount * mult).toPrecision(15));
}
