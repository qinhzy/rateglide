import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  decimalSeparator,
  inferCurrency,
  parseAmount,
  parseMoney,
  parseNumber,
  priceBeside,
  type PageContext,
} from '../src/core/parser';
import { DEFAULTS } from '../src/core/types';
const cases: [string, number, string][] = [
  ['$129.00', 129, 'USD'],
  ['US$ 1,234.56', 1234.56, 'USD'],
  ['USD100', 100, 'USD'],
  ['100USD', 100, 'USD'],
  ['€ 1.234,56', 1234.56, 'EUR'],
  ['1 234,56 EUR', 1234.56, 'EUR'],
  ['CHF 1’234.50', 1234.5, 'CHF'],
  ['HK$ 2,680', 2680, 'HKD'],
  ['CA$89.95', 89.95, 'CAD'],
  ['A$100', 100, 'AUD'],
  ['NZ$50', 50, 'NZD'],
  ['S$80', 80, 'SGD'],
  ['NT$500', 500, 'TWD'],
  ['R$ 123,45', 123.45, 'BRL'],
  ['¥12,800', 12800, 'JPY'],
  ['人民币 1,000', 1000, 'CNY'],
  ['１０００ ＵＳＤ', 1000, 'USD'],
  ['2.5万日元', 25000, 'JPY'],
  ['3亿港元', 3e8, 'HKD'],
  ['USD 2.5k', 2500, 'USD'],
  ['EUR 1.2m', 1.2e6, 'EUR'],
  ['₩ 49,000', 49000, 'KRW'],
  ['฿1280', 1280, 'THB'],
  ['₹1,23,456', 123456, 'INR'],
  ['USD ١٢٣٫٤٥', 123.45, 'USD'],
  ['USD -25.50', -25.5, 'USD'],
  ['(USD 12.00)', -12, 'USD'],
  ['$100 USD', 100, 'USD'],
  ['CN¥100', 100, 'CNY'],
  ['JPY 0', 0, 'JPY'],
  ['£12.34', 12.34, 'GBP'],
  ['usd 12', 12, 'USD'],
  ['1.234.567 EUR', 1234567, 'EUR'],
  ['1,234,567 USD', 1234567, 'USD'],
  ['1\u202f234\u202f567,89 EUR', 1234567.89, 'EUR'],
];
for (const [text, amount, currency] of cases)
  test(`recognizes ${text}`, () => {
    const p = parseMoney(text);
    assert.equal(p?.amount, amount);
    assert.equal(p?.currency, currency);
  });
for (const text of [
  'hello world',
  '2026-09-08',
  '129.99',
  '$100 - $200',
  'USD 100 20',
  'USD 100 EUR 200',
  'USD100USD200',
  '100 USD 200',
  '12.34.56 USD',
  '1,23,45 USD',
  'NaN USD',
  'Infinity USD',
  'USD 1e9',
  'USD 1000000000001',
  '$100\n$200',
  'USD',
  '¥',
  '12 / 100 USD',
  '$1 + $2',
  'discount 30% USD',
])
  test(`rejects ${text}`, () => assert.equal(parseMoney(text), null));
test('ambiguous dollars use preference with explicit hint', () => {
  const p = parseMoney('$10', { ...DEFAULTS, defaultDollar: 'CAD' });
  assert.equal(p?.currency, 'CAD');
  assert.ok(p?.ambiguous);
  assert.match(p!.hint!, /CAD/);
});
test('explicit currency beats ambiguous symbol', () =>
  assert.equal(parseMoney('CNY ¥100')?.currency, 'CNY'));
test('numbers-only is opt in', () => {
  assert.equal(parseMoney('10'), null);
  assert.equal(
    parseMoney('10', { ...DEFAULTS, numbersOnly: true, defaultCurrency: 'EUR' })?.currency,
    'EUR',
  );
});
test('zero and invalid numeric inputs distinct', () => {
  assert.equal(parseNumber(''), null);
  assert.equal(parseNumber('0'), 0);
  assert.equal(parseNumber('..'), null);
  assert.equal(parseNumber('1,00'), 1);
});
test('amount fields accept k, m, bn and Chinese multipliers', () => {
  for (const [text, amount] of [
    ['2.5k', 2500],
    ['1.1K', 1100],
    ['3 m', 3e6],
    ['1bn', 1e9],
    ['2.5万', 25000],
    ['1.2亿', 1.2e8],
    ['８千', 8000],
    ['1,234.5', 1234.5],
  ] as const)
    assert.equal(parseAmount(text), amount, text);
  for (const text of ['k', '2.5kk', '1e3', 'abc', '9999999999999k', ''])
    assert.equal(parseAmount(text), null, text);
});
test('local symbols and suffixes common on shopping sites', () => {
  for (const [text, amount, currency] of [
    ['1,980円', 1980, 'JPY'],
    ['¥1,980（税込）', 1980, 'JPY'],
    ['1,980円 (税込)', 1980, 'JPY'],
    ['15,000원', 15000, 'KRW'],
    ['1.2만원', 12000, 'KRW'],
    ['RM 25.90', 25.9, 'MYR'],
    ['RM25.90', 25.9, 'MYR'],
    ['Rp 150.000', 150000, 'IDR'],
    ['Rp1.500.000', 1500000, 'IDR'],
    ['Rp 50rb', 50000, 'IDR'],
    ['Rp 1,5 juta', 1500000, 'IDR'],
    ['25,99 zł', 25.99, 'PLN'],
    ['1 299 Kč', 1299, 'CZK'],
    ['12 990 Ft', 12990, 'HUF'],
    ['49,99 lei', 49.99, 'RON'],
    ['S/ 25.90', 25.9, 'PEN'],
    ['Fr. 12.50', 12.5, 'CHF'],
    ['Fr. 12.–', 12, 'CHF'],
    ['1 299 руб.', 1299, 'RUB'],
    ['150.000₫', 150000, 'VND'],
    ['150.000đ', 150000, 'VND'],
    ['150.000 VNĐ', 150000, 'VND'],
    ['₸ 5 000', 5000, 'KZT'],
    ['€10 (inkl. MwSt.)', 10, 'EUR'],
    ['1.299,- €', 1299, 'EUR'],
  ] as const) {
    const p = parseMoney(text);
    assert.equal(p?.amount, amount, text);
    assert.equal(p?.currency, currency, text);
  }
});
test('word multipliers for millions, billions, lakh and crore', () => {
  for (const [text, amount, currency] of [
    ['$1.5 million', 1.5e6, 'USD'],
    ['$2.5 billion', 2.5e9, 'USD'],
    ['$1.5B', 1.5e9, 'USD'],
    ['€3 Mrd.', 3e9, 'EUR'],
    ['1,5 Mio. €', 1.5e6, 'EUR'],
    ['1.5千万日元', 1.5e7, 'JPY'],
    ['3百万美元', 3e6, 'USD'],
    ['₹15 lakh', 1.5e6, 'INR'],
    ['₹1.2 crore', 1.2e7, 'INR'],
  ] as const) {
    const p = parseMoney(text);
    assert.equal(p?.amount, amount, text);
    assert.equal(p?.currency, currency, text);
  }
});
test('letter symbols only count as whole words', () => {
  for (const text of ['FIRM 25', 'BAUD 9600', 'Ukr 5', 'R 250', '5 krone 3'])
    assert.equal(parseMoney(text), null, text);
});
test('shared symbols follow the page language and domain', () => {
  const cases: [string, PageContext, string][] = [
    ['¥ 899', { lang: 'zh-CN' }, 'CNY'],
    ['￥899.00', { host: 'item.jd.com', lang: 'zh' }, 'CNY'],
    ['¥ 899', { lang: 'ja' }, 'JPY'],
    ['¥ 899', { host: 'www.amazon.co.jp', lang: 'en' }, 'JPY'],
    ['$ 49', { host: 'www.amazon.ca' }, 'CAD'],
    ['$ 49', { lang: 'en-AU' }, 'AUD'],
    ['$ 49', { lang: 'zh-TW' }, 'TWD'],
    ['$ 49', { lang: 'zh-HK' }, 'HKD'],
    ['100元', { lang: 'zh-TW' }, 'TWD'],
    ['199 kr', { host: 'www.elgiganten.dk' }, 'DKK'],
    ['199 kr', { lang: 'nb' }, 'NOK'],
    ['Rs. 1,499', { host: 'www.daraz.pk' }, 'PKR'],
    ['R 250', { host: 'www.takealot.co.za' }, 'ZAR'],
  ];
  for (const [text, context, currency] of cases) {
    const p = parseMoney(text, DEFAULTS, context);
    assert.equal(p?.currency, currency, `${text} ${JSON.stringify(context)}`);
    assert.ok(p?.ambiguous);
    assert.match(p!.hint!, /根据网页语言或地区/);
  }
});
test('shared symbols without a page hint use preferences and defaults', () => {
  for (const [text, context, currency] of [
    ['¥ 899', undefined, 'JPY'],
    ['¥ 899', { lang: 'zh-Hant', host: 'shop.tmall.hk' }, 'JPY'],
    ['$ 49', { host: 'angel.co' }, 'USD'],
    ['$ 49', { lang: 'zh-CN' }, 'USD'],
    ['199 kr', undefined, 'SEK'],
    ['Rs. 1,499', undefined, 'INR'],
    ['100元', undefined, 'CNY'],
    ['¥899元', { lang: 'ja' }, 'CNY'],
  ] as const) {
    const p = parseMoney(text, DEFAULTS, context);
    assert.equal(p?.currency, currency, `${text} ${JSON.stringify(context)}`);
    assert.doesNotMatch(p!.hint!, /根据网页/);
  }
  assert.equal(parseMoney('$10 kr'), null);
});
test('page hints can be turned off', () => {
  const p = parseMoney('¥ 899', { ...DEFAULTS, smartSymbols: false }, { lang: 'zh-CN' });
  assert.equal(p?.currency, 'JPY');
  assert.equal(
    parseMoney('R 250', { ...DEFAULTS, smartSymbols: false }, { host: 'a.co.za' }),
    null,
  );
  assert.equal(
    parseMoney('1.299 €', { ...DEFAULTS, smartSymbols: false }, { lang: 'de' })?.amount,
    1.299,
  );
});
test('a lone separator follows the page number format', () => {
  assert.equal(parseMoney('1.299 €', DEFAULTS, { lang: 'de' })?.amount, 1299);
  assert.equal(parseMoney('1,789 €', DEFAULTS, { lang: 'de-DE' })?.amount, 1.789);
  assert.equal(parseMoney('€1.789', DEFAULTS, { lang: 'en-IE' })?.amount, 1.789);
  assert.equal(parseMoney('1.299 €')?.amount, 1.299);
  assert.equal(parseMoney('1,789 €')?.amount, 1789);
  assert.equal(parseMoney('€ 1.234,56', DEFAULTS, { lang: 'en' })?.amount, 1234.56);
  // Whole-unit currencies group thousands whatever the page language.
  assert.equal(parseMoney('15,000원', DEFAULTS, { lang: 'de' })?.amount, 15000);
  assert.equal(parseNumber('150.000', { wholeUnits: true }), 150000);
  assert.equal(parseNumber('150.000'), 150);
});
test('page hints are optional and tolerate malformed values', () => {
  assert.equal(inferCurrency('$', { lang: '!!', host: '' }), null);
  assert.equal(inferCurrency('¥', { lang: 'zh_CN' }), 'CNY');
  assert.equal(inferCurrency('$', { host: 'shop.example.ca.' }), 'CAD');
  assert.equal(inferCurrency('$', { host: '127.0.0.1' }), null);
  assert.equal(decimalSeparator('not a language tag at all'), undefined);
  assert.equal(decimalSeparator('fr'), ',');
  assert.equal(decimalSeparator('ar-EG'), undefined);
});
test('a double-clicked number takes the currency written beside it', () => {
  const read = (text: string) => parseMoney(text);
  for (const [number, before, after, amount, currency] of [
    ['129.00', 'Price: $', ' today', 129, 'USD'],
    ['129.00', 'Price:$', '', 129, 'USD'],
    ['2,680', 'from HK$ ', '', 2680, 'HKD'],
    ['1.234,56', '€', ' incl.', 1234.56, 'EUR'],
    ['1,980', '', '円（税込）', 1980, 'JPY'],
    ['15,000', '', '원입니다', 15000, 'KRW'],
    ['129', '', '元左右', 129, 'CNY'],
    ['129.00', '', ' USD.', 129, 'USD'],
    ['1.5', 'raised $', ' million in', 1.5e6, 'USD'],
    ['2.5', '', '万日元', 25000, 'JPY'],
  ] as const) {
    const p = priceBeside(number, before, after, read);
    assert.equal(p?.amount, amount, `${before}[${number}]${after}`);
    assert.equal(p?.currency, currency, `${before}[${number}]${after}`);
  }
});
test('neighbouring words never lend a currency', () => {
  const read = (text: string) => parseMoney(text);
  for (const [number, before, after] of [
    ['9600', 'BAUD ', ''],
    ['129', 'Page ', ' of 300'],
    ['129', '', ' USDT'],
    ['129', 'Total', ''],
    ['abc', '$', ''],
  ] as const)
    assert.equal(priceBeside(number, before, after, read), null, `${before}[${number}]${after}`);
  // “b” in “billing” is not a billions suffix.
  assert.equal(priceBeside('5', '$', ' billing', read)?.amount, 5);
});
