import { getLanguage, getLocale } from '../i18n';
const codes =
  'AED AFN ALL AMD ANG AOA ARS AUD AWG AZN BAM BBD BDT BGN BHD BIF BMD BND BOB BRL BSD BTN BWP BYN BZD CAD CDF CHF CLF CLP CNH CNY COP CRC CUP CVE CZK DJF DKK DOP DZD EGP ERN ETB EUR FJD FKP FOK GBP GEL GGP GHS GIP GMD GNF GTQ GYD HKD HNL HRK HTG HUF IDR ILS IMP INR IQD IRR ISK JEP JMD JOD JPY KES KGS KHR KID KMF KRW KWD KYD KZT LAK LBP LKR LRD LSL LYD MAD MDL MGA MKD MMK MNT MOP MRU MUR MVR MWK MXN MYR MZN NAD NGN NIO NOK NPR NZD OMR PAB PEN PGK PHP PKR PLN PYG QAR RON RSD RUB RWF SAR SBD SCR SDG SEK SGD SHP SLE SLL SOS SRD SSP STN SYP SZL THB TJS TMT TND TOP TRY TTD TVD TWD TZS UAH UGX USD UYU UZS VES VND VUV WST XAF XCD XCG XDR XOF XPF YER ZAR ZMW ZWG ZWL'.split(
    ' ',
  );
const names = new Intl.DisplayNames(['zh-CN'], { type: 'currency' });
const en = new Intl.DisplayNames(['en'], { type: 'currency' });
const overrides: Record<string, string> = {
  CNH: '离岸人民币',
  CNY: '人民币',
  USD: '美元',
  HKD: '港币',
  JPY: '日元',
  TWD: '新台币',
  MOP: '澳门元',
  XCG: '加勒比盾',
  ZWG: '津巴布韦金元',
  FOK: '法罗克朗',
  KID: '基里巴斯元',
  TVD: '图瓦卢元',
};
const enOverrides: Record<string, string> = {
  CNH: 'Offshore Chinese Yuan',
  FOK: 'Faroese Króna',
  KID: 'Kiribati Dollar',
  TVD: 'Tuvaluan Dollar',
  ZWG: 'Zimbabwe Gold',
  XCG: 'Caribbean Guilder',
};
const countries: Record<string, string> = {
  EUR: 'EU',
  GBP: 'GB',
  USD: 'US',
  CNY: 'CN',
  CNH: 'CN',
  JPY: 'JP',
  HKD: 'HK',
  SGD: 'SG',
  CHF: 'CH',
  XAF: 'CM',
  XOF: 'SN',
  XPF: 'PF',
  XCD: 'AG',
  XDR: '',
  ANG: 'CW',
  XCG: 'CW',
};
// Everyday Chinese names that differ from the official Intl names. The selection parser
// recognizes them in page text, and currency search accepts them as queries.
export const currencyAliases: Record<string, string> = {
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
export const currencies = codes.map((code) => ({
  code,
  name: overrides[code] || names.of(code) || code,
  en: en.of(code) || code,
  flag: flag(code),
}));
export const currencyCodes = new Set(codes);
export function currencyName(code: string) {
  return getLanguage() === 'en'
    ? enOverrides[code] || en.of(code) || code
    : overrides[code] || names.of(code) || code;
}
export function flag(code: string) {
  const c = countries[code] ?? code.slice(0, 2);
  return c ? String.fromCodePoint(...[...c].map((x) => 127397 + x.charCodeAt(0))) : '◎';
}

// Frequently traded or travelled currencies break ties in search results.
const popular =
  'USD EUR CNY JPY GBP HKD AUD CAD CHF SGD KRW TWD NZD THB MOP MYR INR SEK NOK DKK AED MXN BRL TRY ZAR PHP IDR VND RUB'.split(
    ' ',
  );
function regionNames(locale: string) {
  try {
    return new Intl.DisplayNames([locale], { type: 'region' });
  } catch {
    return null;
  }
}
const zhRegion = regionNames('zh-CN'),
  enRegion = regionNames('en');
function region(names: Intl.DisplayNames | null, code: string) {
  try {
    const c = countries[code] ?? code.slice(0, 2);
    const name = c && names?.of(c);
    return name && name !== c ? name : '';
  } catch {
    return '';
  }
}
/** The country or region a currency's flag represents, in the interface language. */
export function currencyRegion(code: string) {
  return region(getLanguage() === 'en' ? enRegion : zhRegion, code);
}
let index: { code: string; aliases: string[]; terms: string[] }[] | null = null;
function searchIndex() {
  if (index) return index;
  index = currencies.map((c) => ({
    code: c.code,
    aliases: Object.keys(currencyAliases).filter((alias) => currencyAliases[alias] === c.code),
    terms: [
      c.name,
      c.en,
      enOverrides[c.code] || '',
      region(zhRegion, c.code),
      region(enRegion, c.code),
    ]
      .filter(Boolean)
      .map((term) => term.toLowerCase()),
  }));
  return index;
}
function score(entry: { code: string; aliases: string[]; terms: string[] }, query: string) {
  const code = entry.code.toLowerCase();
  if (code === query) return 100;
  if (code.startsWith(query)) return 80;
  if (entry.aliases.includes(query)) return 70;
  if (entry.terms.includes(query)) return 65;
  if (entry.terms.some((term) => term.startsWith(query))) return 50;
  if (entry.terms.some((term) => term.split(/[\s\-'’()]+/).some((word) => word.startsWith(query))))
    return 40;
  if ([...entry.aliases, ...entry.terms].some((term) => term.includes(query))) return 20;
  return 0;
}
/** Currency codes matching a code, name, alias or country/region, most relevant first. */
export function searchCurrencies(query: string, preferred: readonly string[] = []) {
  const q = query.normalize('NFKC').trim().toLowerCase();
  if (!q) return [];
  const rank = (code: string, list: readonly string[]) => {
    const i = list.indexOf(code);
    return i < 0 ? list.length : i;
  };
  return searchIndex()
    .map((entry) => ({ code: entry.code, score: score(entry, q) }))
    .filter((x) => x.score > 0)
    .sort(
      (a, b) =>
        b.score - a.score ||
        rank(a.code, preferred) - rank(b.code, preferred) ||
        rank(a.code, popular) - rank(b.code, popular) ||
        a.code.localeCompare(b.code),
    )
    .map((x) => x.code);
}
export function decimals(code: string) {
  try {
    return (
      new Intl.NumberFormat(getLocale(), { style: 'currency', currency: code }).resolvedOptions()
        .maximumFractionDigits ?? 2
    );
  } catch {
    return 2;
  }
}
export function formatAmount(amount: number, code: string) {
  if (!Number.isFinite(amount)) return '—';
  const d = decimals(code);
  return new Intl.NumberFormat(getLocale(), {
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  }).format(amount);
}
export function formatRate(rate: number) {
  return new Intl.NumberFormat(getLocale(), { maximumSignificantDigits: 6 }).format(rate);
}
