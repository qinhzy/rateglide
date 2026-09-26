import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { searchCurrencies, formatRate, currencyRegion } from '../src/data/currencies';
import { setLanguage } from '../src/i18n';

afterEach(() => setLanguage('system'));
test('exact and prefix code matches come first', () => {
  assert.equal(searchCurrencies('eur')[0], 'EUR');
  assert.equal(searchCurrencies('US')[0], 'USD');
  assert.equal(searchCurrencies('ｈｋｄ')[0], 'HKD');
});
test('everyday Chinese names find the right currency', () => {
  assert.equal(searchCurrencies('加元')[0], 'CAD');
  assert.equal(searchCurrencies('美金')[0], 'USD');
  assert.equal(searchCurrencies('台币')[0], 'TWD');
  assert.equal(searchCurrencies('港币')[0], 'HKD');
});
test('countries and regions are searchable in both languages', () => {
  assert.equal(searchCurrencies('China')[0], 'CNY');
  assert.equal(searchCurrencies('日本')[0], 'JPY');
  assert.equal(searchCurrencies('switzerland')[0], 'CHF');
  assert.ok(searchCurrencies('European Union').includes('EUR'));
});
test('ties prefer the watchlist, then widely used currencies', () => {
  assert.equal(searchCurrencies('dollar')[0], 'USD');
  assert.equal(searchCurrencies('dollar', ['SGD'])[0], 'SGD');
  assert.deepEqual(searchCurrencies(''), []);
  assert.deepEqual(searchCurrencies('zzzz'), []);
});
test('rates use six significant digits', () => {
  setLanguage('en');
  assert.equal(formatRate(7.123456789), '7.12346');
  assert.equal(formatRate(0.0000613497123), '0.0000613497');
});
test('currency regions follow the interface language', () => {
  setLanguage('en');
  assert.equal(currencyRegion('JPY'), 'Japan');
  setLanguage('zh-CN');
  assert.equal(currencyRegion('JPY'), '日本');
  assert.equal(currencyRegion('XDR'), '');
});
