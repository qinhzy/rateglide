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
  return new Intl.NumberFormat(getLocale(), { maximumSignificantDigits: 8 }).format(rate);
}
