import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  cardRate,
  parseCardResponse,
  parseRevolut,
  currencyScale,
  revolutRate,
  today,
  validateCardInput,
  dateValue,
} from '../src/core/payments';
import type { CardInput } from '../src/core/types';
const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
});
const input: CardInput = {
  network: 'visa',
  from: 'USD',
  to: 'CNY',
  amount: 100,
  bankFee: 1.5,
  date: today(),
};
const visa = () => ({
  status: 'success',
  conversionBankFee: '1.5',
  originalValues: {
    fromCurrency: 'USD',
    toCurrency: 'CNY',
    fromAmount: '100',
    asOfDate: dateValue(today()) / 1000,
    fxRateVisa: '6.710676411',
    fxRateWithAdditionalFee: '6.8113365572',
    toAmountWithAdditionalFee: '681.133656',
  },
});
const mc = () => ({
  data: {
    transCurr: 'USD',
    crdhldBillCurr: 'CNY',
    transAmt: '100',
    bankFee: '1.5',
    conversionRate: '6.8129845',
    crdhldBillAmt: '681.2984500',
    fxDate: today(),
  },
});
test('Visa fees are included once, not added twice', () => {
  const q = parseCardResponse(visa(), input);
  assert.equal(q.total, 681.133656);
  assert.equal(q.baseRate, 6.710676411);
  assert.ok(Math.abs(q.feeAmount - 10.0660149) < 1e-5);
});
test('Mastercard official total includes bank fee', () => {
  const q = parseCardResponse(mc(), { ...input, network: 'mastercard' });
  assert.equal(q.total, 681.29845);
  assert.ok(Math.abs(q.baseRate - 6.7123) < 1e-9);
});
test('Mastercard zero fee can omit bankFee property', () => {
  const data = mc();
  delete (data.data as any).bankFee;
  data.data.conversionRate = '6.7123';
  data.data.crdhldBillAmt = '671.23';
  assert.equal(
    parseCardResponse(data, { ...input, network: 'mastercard', bankFee: 0 }).feeAmount,
    0,
  );
});
test('Visa request uses observed reversed parameter names', async () => {
  let url = '';
  globalThis.fetch = async (u) => {
    url = String(u);
    return Response.json(visa());
  };
  await cardRate(input);
  const q = new URL(url).searchParams;
  assert.equal(q.get('fromCurr'), 'CNY');
  assert.equal(q.get('toCurr'), 'USD');
  assert.equal(q.get('fee'), '1.5');
  assert.equal(q.get('utcConvertedDate'), q.get('exchangedate'));
});
test('Mastercard latest request uses official latest sentinel', async () => {
  let url = '';
  globalThis.fetch = async (u) => {
    url = String(u);
    return Response.json(mc());
  };
  await cardRate({ ...input, network: 'mastercard', date: '' });
  const q = new URL(url).searchParams;
  assert.equal(q.get('exchange_date'), '0000-00-00');
  assert.equal(q.get('transaction_currency'), 'USD');
  assert.equal(q.get('cardholder_billing_currency'), 'CNY');
});
test('returned older published date is preserved', () => {
  const data = mc();
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  data.data.fxDate = yesterday;
  assert.equal(parseCardResponse(data, { ...input, network: 'mastercard' }).rateDate, yesterday);
});
test('Visa inverted response rejected even if rate is numeric', () => {
  const data = visa();
  data.originalValues.fromCurrency = 'CNY';
  assert.throws(() => parseCardResponse(data, input), /方向/);
});
test('mismatched card amount rejected', () => {
  const data = mc();
  data.data.transAmt = '1000';
  assert.throws(() => parseCardResponse(data, { ...input, network: 'mastercard' }), /金额/);
});
test('missing fee on a nonzero-fee response is rejected', () => {
  const data = mc();
  delete (data.data as any).bankFee;
  assert.throws(() => parseCardResponse(data, { ...input, network: 'mastercard' }), /费率/);
});
test('inconsistent card total rejected', () => {
  const data = visa();
  data.originalValues.toAmountWithAdditionalFee = '1000';
  assert.throws(() => parseCardResponse(data, input), /不一致/);
});
test('unavailable card response never becomes a market quote', () =>
  assert.throws(() => parseCardResponse({ status: 'error' }, input), /未公布/));
test('invalid calendar dates rejected', () => assert.throws(() => dateValue('2026-02-31')));
test('future requested dates rejected', () =>
  assert.throws(
    () =>
      validateCardInput({
        ...input,
        date: new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10),
      }),
    /未来/,
  ));
test('future response dates rejected', () => {
  const data = mc();
  data.data.fxDate = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  assert.throws(() => parseCardResponse(data, { ...input, network: 'mastercard' }), /日期/);
});
test('negative, invalid and excessive card fees rejected', () => {
  for (const bankFee of [-1, NaN, Infinity, 31])
    assert.throws(() => validateCardInput({ ...input, bankFee }));
});
test('invalid card amounts and network rejected', () => {
  for (const amount of [0, -1, NaN, Infinity, 1e9])
    assert.throws(() => validateCardInput({ ...input, amount }));
  assert.throws(() => validateCardInput({ ...input, network: 'fake' as any }));
});
test('same currency card computation does not call network', async () => {
  globalThis.fetch = async () => {
    throw new Error('unexpected');
  };
  const q = await cardRate({ ...input, to: 'USD' });
  assert.ok(Math.abs(q.total - 101.5) < 1e-10);
});
const revolut = (from = 'USD', to = 'CNY') => ({
  sender: { amount: 10000, currency: from },
  recipient: { amount: 66653, currency: to },
  rate: { from, to, rate: 6.6653, timestamp: Date.now() },
  plans: [
    {
      id: 'STANDARD',
      name: 'Standard',
      fees: { total: { amount: 100, currency: from }, cost: { amount: 10100, currency: from } },
    },
  ],
});
test('Revolut converts decimal currency minor units correctly', () => {
  const q = parseRevolut(revolut(), 'USD', 'CNY', 100, 'GB');
  assert.equal(q.received, 666.53);
  assert.equal(q.plans[0].fee, 1);
  assert.equal(q.plans[0].cost, 101);
});
test('JPY has no extra division by one hundred', () => {
  const q = parseRevolut(revolut('JPY'), 'JPY', 'CNY', 10000, 'GB');
  assert.equal(q.amount, 10000);
  assert.equal(q.plans[0].fee, 100);
  assert.equal(q.received, 666.53);
});
test('zero, two and three decimal currencies scale correctly', () => {
  assert.equal(currencyScale('JPY'), 1);
  assert.equal(currencyScale('USD'), 100);
  assert.equal(currencyScale('KWD'), 1000);
});
test('Revolut rejects wrong fee currency', () => {
  const data = revolut();
  data.plans[0].fees.total.currency = 'EUR';
  assert.throws(() => parseRevolut(data, 'USD', 'CNY', 100, 'GB'), /币种/);
});
test('Revolut amount mismatch rejected', () =>
  assert.throws(() => parseRevolut(revolut(), 'USD', 'CNY', 1000, 'GB'), /金额/));
test('Revolut future timestamp rejected', () => {
  const data = revolut();
  data.rate.timestamp = Date.now() + 86400000;
  assert.throws(() => parseRevolut(data, 'USD', 'CNY', 100, 'GB'), /时间/);
});
test('Revolut required locale header and amount units sent', async () => {
  let url = '',
    headers: any;
  globalThis.fetch = async (u, init) => {
    url = String(u);
    headers = init?.headers;
    return Response.json(revolut());
  };
  await revolutRate('USD', 'CNY', 100);
  assert.equal(new URL(url).searchParams.get('amount'), '10000');
  assert.equal(headers['Accept-Language'], 'en');
});
