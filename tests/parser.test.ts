import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseMoney, parseNumber } from '../src/core/parser';
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
