import { request, validPair, validateQuote } from './providers';
import type { CardInput, CardQuote, CardNetwork, RevolutQuote, Quote } from './types';

export const CARD_LABELS: Record<CardNetwork, string> = { visa: 'Visa', mastercard: 'Mastercard' };
export function today() {
  return new Date().toISOString().slice(0, 10);
}
export function dateValue(date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('请选择有效日期');
  const time = Date.parse(date + 'T00:00:00Z');
  if (!Number.isFinite(time) || new Date(time).toISOString().slice(0, 10) !== date)
    throw new Error('请选择有效日期');
  return time;
}
export function validateCardInput(input: CardInput) {
  validPair(input.from, input.to);
  if (!['visa', 'mastercard'].includes(input.network)) throw new Error('不支持的卡组织');
  if (!Number.isFinite(input.amount) || input.amount <= 0 || input.amount > 1e8)
    throw new Error('交易金额应大于 0 且不超过 1 亿');
  if (!Number.isFinite(input.bankFee) || input.bankFee < 0 || input.bankFee > 30)
    throw new Error('发卡行附加费应在 0% 到 30% 之间');
  if (input.date) {
    const time = dateValue(input.date);
    if (time > dateValue(today())) throw new Error('不能查询未来日期');
    if (time < dateValue(today()) - 365 * 86400000) throw new Error('请选择最近 365 天内的日期');
  }
}
function number(value: unknown, label: string, zero = false) {
  if ((typeof value !== 'number' && typeof value !== 'string') || String(value).trim() === '')
    throw new Error(label + '数据缺失');
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0 || (!zero && n === 0)) throw new Error(label + '数据无效');
  return n;
}
function close(a: number, b: number, tolerance = 0.00001) {
  return Math.abs(a - b) <= Math.max(tolerance, Math.abs(b) * 1e-8);
}
export function parseCardResponse(data: any, input: CardInput): CardQuote {
  validateCardInput(input);
  let rate: number, baseRate: number, total: number, date: string, updatedAt: number | undefined;
  if (input.network === 'visa') {
    const v = data?.originalValues;
    if (data?.status !== 'success' || !v) throw new Error('Visa 未公布此币种或日期的报价');
    if (v.fromCurrency !== input.from || v.toCurrency !== input.to)
      throw new Error('Visa 返回的货币方向不符');
    if (
      !close(number(v.fromAmount, '交易金额'), input.amount) ||
      !close(number(data.conversionBankFee, '银行费率', true), input.bankFee)
    )
      throw new Error('Visa 返回的金额或费率不符');
    rate = number(v.fxRateWithAdditionalFee, 'Visa 汇率');
    baseRate = number(v.fxRateVisa, 'Visa 基础汇率');
    total = number(v.toAmountWithAdditionalFee, 'Visa 账单金额');
    const asOf = number(v.asOfDate, 'Visa 报价日期') * 1000;
    if (!Number.isFinite(asOf) || asOf > Date.now() + 86400000)
      throw new Error('Visa 报价日期无效');
    date = new Date(asOf).toISOString().slice(0, 10);
    if (typeof v.lastUpdatedVisaRate === 'number') updatedAt = v.lastUpdatedVisaRate * 1000;
  } else {
    const v = data?.data;
    if (!v?.conversionRate || !v.fxDate) throw new Error('Mastercard 未公布此币种或日期的报价');
    if (v.transCurr !== input.from || v.crdhldBillCurr !== input.to)
      throw new Error('Mastercard 返回的货币方向不符');
    if (
      !close(number(v.transAmt, '交易金额'), input.amount) ||
      !close(number(v.bankFee ?? 0, '银行费率', true), input.bankFee)
    )
      throw new Error('Mastercard 返回的金额或费率不符');
    // The official conversionRate and bill amount already include bank_fee.
    rate = number(v.conversionRate, 'Mastercard 汇率');
    baseRate = rate / (1 + input.bankFee / 100);
    total = number(v.crdhldBillAmt, 'Mastercard 账单金额');
    date = v.fxDate;
  }
  if (!close(rate, baseRate * (1 + input.bankFee / 100)) || !close(total, input.amount * rate))
    throw new Error('卡组织返回的汇率与金额不一致');
  const asOf = dateValue(date);
  if (asOf > dateValue(today()) || (input.date && asOf > dateValue(input.date)))
    throw new Error('卡组织返回的日期与查询不符');
  return {
    ...input,
    rate,
    baseRate,
    total,
    feeAmount: input.bankFee === 0 ? 0 : Math.max(0, total - input.amount * baseRate),
    rateDate: date,
    asOf,
    updatedAt,
    fetchedAt: Date.now(),
  };
}
export async function cardRate(input: CardInput): Promise<CardQuote> {
  validateCardInput(input);
  if (input.from === input.to)
    return {
      ...input,
      rate: 1 + input.bankFee / 100,
      baseRate: 1,
      total: input.amount * (1 + input.bankFee / 100),
      feeAmount: (input.amount * input.bankFee) / 100,
      rateDate: input.date || today(),
      asOf: dateValue(input.date || today()),
      fetchedAt: Date.now(),
    };
  let path: string;
  if (input.network === 'visa') {
    const [y, m, d] = (input.date || today()).split('-'),
      date = `${m}/${d}/${y}`;
    // Visa's API names are reversed relative to the calculator's From / To labels.
    path =
      '/cmsapi/fx/rates?' +
      new URLSearchParams({
        amount: String(input.amount),
        fee: String(input.bankFee),
        utcConvertedDate: date,
        exchangedate: date,
        fromCurr: input.to,
        toCurr: input.from,
      });
  } else
    path =
      '/marketingservices/public/mccom-services/currency-conversions/conversion-rates?' +
      new URLSearchParams({
        exchange_date: input.date || '0000-00-00',
        transaction_currency: input.from,
        cardholder_billing_currency: input.to,
        bank_fee: String(input.bankFee),
        transaction_amount: String(input.amount),
      });
  return parseCardResponse(await request(input.network, path), input);
}
export function cardAsQuote(q: CardQuote): Quote {
  return validateQuote({
    from: q.from,
    to: q.to,
    rate: q.baseRate,
    source: q.network,
    label: CARD_LABELS[q.network],
    kind: '卡组织公布价',
    asOf: q.asOf,
    fetchedAt: q.fetchedAt,
    cached: q.cached,
    stale: q.stale,
    url:
      q.network === 'visa'
        ? 'https://www.visa.co.uk/support/consumer/travel-support/exchange-rate-calculator.html'
        : 'https://www.mastercard.com/global/en/personal/get-support/currency-exchange-rate-converter.html',
    notice: `报价日期 ${q.rateDate}，不含发卡行附加费。可在「刷卡」中选择日期并计算费用；最终入账以发卡行为准。`,
  });
}
export function currencyScale(currency: string) {
  return (
    10 **
    (new Intl.NumberFormat('en', { style: 'currency', currency }).resolvedOptions()
      .maximumFractionDigits ?? 2)
  );
}
export function parseRevolut(
  data: any,
  from: string,
  to: string,
  amount: number,
  country: string,
): RevolutQuote {
  const a = data?.sender,
    b = data?.recipient,
    r = data?.rate;
  if (a?.currency !== from || b?.currency !== to || r?.from !== from || r?.to !== to)
    throw new Error('Revolut 返回的货币对不符');
  const scale = currencyScale(from),
    toScale = currencyScale(to);
  if (number(a.amount, '汇出金额') !== Math.round(amount * scale))
    throw new Error('Revolut 返回的金额不符');
  const rate = number(r.rate, 'Revolut 汇率'),
    asOf = number(r.timestamp, 'Revolut 时间');
  if (asOf > Date.now() + 60000) throw new Error('Revolut 报价时间无效');
  if (!Array.isArray(data.plans) || !data.plans.length) throw new Error('Revolut 未返回可用套餐');
  const plans = data.plans.map((p: any) => {
    if (
      p.fees?.total?.currency !== from ||
      p.fees?.cost?.currency !== from ||
      typeof p.name !== 'string'
    )
      throw new Error('Revolut 套餐费用币种不符');
    return {
      id: String(p.id),
      name: p.name,
      fee: number(p.fees.total.amount, '兑换费用', true) / scale,
      cost: number(p.fees.cost.amount, '总支出') / scale,
    };
  });
  return {
    from,
    to,
    amount: a.amount / scale,
    received: number(b.amount, '换币所得', true) / toScale,
    rate,
    asOf,
    fetchedAt: Date.now(),
    country,
    plans,
  };
}
export async function revolutRate(from: string, to: string, amount: number, country = 'GB') {
  validPair(from, to);
  if (!/^[A-Z]{2}$/.test(country)) throw new Error('请选择有效的账户地区');
  if (
    !Number.isFinite(amount) ||
    amount <= 0 ||
    amount > 1e8 ||
    !Number.isSafeInteger(Math.round(amount * currencyScale(from))) ||
    Math.round(amount * currencyScale(from)) < 1
  )
    throw new Error('请输入有效换币金额');
  const params = new URLSearchParams({
    amount: String(Math.round(amount * currencyScale(from))),
    country,
    fromCurrency: from,
    isRecipientAmount: 'false',
    toCurrency: to,
  });
  const r = await request('revolut', '/api/exchange/quote?' + params);
  return parseRevolut(r, from, to, amount, country);
}
export function revolutAsQuote(q: RevolutQuote): Quote {
  return validateQuote({
    from: q.from,
    to: q.to,
    rate: q.rate,
    source: 'revolut',
    label: 'Revolut',
    kind: '公开换币报价 · 英国',
    asOf: q.asOf,
    fetchedAt: q.fetchedAt,
    url: 'https://www.revolut.com/currency-converter/',
    notice:
      'Revolut 英国地区公开基础汇率；套餐费用可在「比价」查看，账户专属优惠与实际交易报价可能不同。',
  });
}
