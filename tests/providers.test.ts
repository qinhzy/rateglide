import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  bocQuote,
  marketQuote,
  parseBoc,
  parseComparison,
  validateQuote,
} from '../src/core/providers';
import { cleanSettings, siteBlocked } from '../src/core/storage';
const table = {
  USD: { buy: 7.1, sell: 7.2, cashBuy: 7, cashSell: 7.3, asOf: Date.now() },
  JPY: { buy: 0.048, sell: 0.051, cashBuy: 0.04, cashSell: 0.052, asOf: Date.now() },
};
test('BOC foreign currency sold to bank uses bid', () =>
  assert.equal(bocQuote(table, 'USD', 'CNY').rate, 7.1));
test('BOC customer buys USD using ask reciprocal', () =>
  assert.equal(bocQuote(table, 'CNY', 'USD').rate, 1 / 7.2));
test('BOC yen normalized to one unit', () =>
  assert.equal(bocQuote(table, 'JPY', 'CNY').rate, 0.048));
test('BOC unsupported cross pairs rejected', () =>
  assert.throws(() => bocQuote(table, 'USD', 'JPY')));
test('empty bank quotes never become zero rates', () =>
  assert.throws(() =>
    bocQuote(
      { ...table, EUR: { buy: 0, sell: 0, cashBuy: 1, cashSell: 1, asOf: Date.now() } },
      'EUR',
      'CNY',
    ),
  ));
test('broken HTML is not accepted as rates', () =>
  assert.throws(() => parseBoc('<h1>access denied</h1>')));
test('cross conversion derives rate in correct direction', () =>
  assert.equal(
    marketQuote(
      {
        rates: { USD: 1, EUR: 0.9, CNY: 7.2 },
        asOf: Date.now(),
        next: Date.now(),
        fetchedAt: Date.now(),
      },
      'EUR',
      'CNY',
    ).rate,
    8,
  ));
test('unsupported market currency does not render NaN', () =>
  assert.throws(() =>
    marketQuote({ rates: { USD: 1 }, asOf: 1, next: 1, fetchedAt: 1 }, 'USD', 'XYZ'),
  ));
test('bid ask parser preserves unit and timestamp', () => {
  const rows = ['美元', '日元', '港币', '英镑', '欧元']
    .map(
      (name) =>
        `<tr><td>${name}</td><td>710</td><td>700</td><td>720</td><td>730</td><td>715</td><td>2026/09/08 19:36:41</td><td>19:36:41</td></tr>`,
    )
    .join('');
  const r = parseBoc(rows);
  assert.equal(r.USD.buy, 7.1);
  assert.equal(r.USD.sell, 7.2);
  assert.equal(r.USD.asOf, Date.parse('2026-09-08T11:36:41Z'));
});
test('comparison preserves provider fees and country variants', () => {
  const r = parseComparison(
    {
      sourceCurrency: 'USD',
      targetCurrency: 'CNY',
      amount: 100,
      providers: [
        {
          name: 'Bank',
          alias: 'bank',
          type: 'bank',
          quotes: [
            {
              rate: 7,
              fee: 2,
              receivedAmount: 686,
              dateCollected: '2026-09-08T10:00:00Z',
              sourceCountry: 'US',
              targetCountry: 'CN',
            },
            {
              rate: 7,
              fee: 1,
              receivedAmount: 693,
              dateCollected: '2026-09-08T10:00:00Z',
              targetCountry: 'HK',
            },
          ],
        },
      ],
    },
    'USD',
    'CNY',
  );
  assert.equal(r.length, 2);
  assert.equal(r[0].received, 693);
  assert.equal(r[0].fee, 1);
  assert.equal(r[1].sourceCountry, 'US');
});
test('comparison rejects invalid currency route', () =>
  assert.throws(() =>
    parseComparison({ sourceCurrency: 'EUR', targetCurrency: 'CNY', providers: [] }, 'USD', 'CNY'),
  ));
test('comparison drops invalid rates and null fees', () =>
  assert.deepEqual(
    parseComparison(
      {
        sourceCurrency: 'USD',
        targetCurrency: 'CNY',
        providers: [{ name: 'test', quotes: [{ rate: NaN, fee: null, receivedAmount: 1 }] }],
      },
      'USD',
      'CNY',
    ),
    [],
  ));
test('settings are validated and bounded', () => {
  const s = cleanSettings({
    target: 'BAD',
    bankFee: NaN,
    favorites: ['USD', 'BAD', 'USD'],
    source: 'hacker' as any,
  });
  assert.equal(s.target, 'CNY');
  assert.equal(s.bankFee, 0);
  assert.equal(s.source, 'auto');
  assert.deepEqual(s.favorites, ['USD']);
});
test('block domains include subdomains but not suffix-lookalikes', () => {
  assert.equal(siteBlocked('store.example.com', ['example.com']), true);
  assert.equal(siteBlocked('notexample.com', ['example.com']), false);
});
