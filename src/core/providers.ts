import { currencyCodes } from '../data/currencies';
import type { Quote, CompareRow, Source } from './types';
export const SOURCE_LABELS: Record<Source, string> = {
  auto: '智能选择 · 优先 Wise',
  wise: 'Wise · 实时中间价',
  revolut: 'Revolut · 英国公开价',
  visa: 'Visa · 卡组织公布价',
  mastercard: 'Mastercard · 卡组织公布价',
  market: '国际市场 · 每日参考',
  ecb: '央行参考 · 每日公布',
  boc: '中国银行 · 现汇牌价',
};
const roots = {
  wise: 'https://wise.com',
  compare: 'https://api.wise.com',
  market: 'https://open.er-api.com',
  ecb: 'https://api.frankfurter.dev',
  boc: 'https://www.boc.cn',
  visa: 'https://www.visa.co.uk',
  mastercard: 'https://www.mastercard.com',
  revolut: 'https://www.revolut.com',
};
function endpoint(service: keyof typeof roots, path: string) {
  return typeof location !== 'undefined' &&
    /^https?:$/.test(location.protocol) &&
    ['localhost', '127.0.0.1'].includes(location.hostname)
    ? `/api/${service}${path}`
    : roots[service] + path;
}
export async function request(service: keyof typeof roots, path: string, text = false) {
  const c = new AbortController();
  const timeout = setTimeout(() => c.abort(), 10000);
  try {
    const res = await fetch(endpoint(service, path), {
      signal: c.signal,
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      cache: 'no-store',
      headers: service === 'revolut' ? { 'Accept-Language': 'en' } : undefined,
    });
    if (!res.ok)
      throw new Error(
        res.status === 429 ? '来源请求过于频繁，请稍后再试' : `来源暂不可用（${res.status}）`,
      );
    return text ? await res.text() : await res.json();
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') throw new Error('连接汇率来源超时，请重试');
    throw e;
  } finally {
    clearTimeout(timeout);
  }
}
export function validPair(from: string, to: string) {
  if (!currencyCodes.has(from) || !currencyCodes.has(to)) throw new Error('不支持的币种代码');
}
export function validateQuote(q: Quote) {
  if (!Number.isFinite(q.rate) || q.rate <= 0 || q.rate > 1e12)
    throw new Error('来源返回了无效汇率');
  if (!Number.isFinite(q.asOf) || q.asOf <= 0 || q.asOf > Date.now() + 86400000)
    throw new Error('来源未提供有效更新时间');
  return q;
}
export async function wiseRate(from: string, to: string): Promise<Quote> {
  const r = await request('wise', `/rates/live?source=${from}&target=${to}`);
  if (r.source !== from || r.target !== to) throw new Error('Wise 不支持此货币对');
  return validateQuote({
    from,
    to,
    rate: r.value,
    source: 'wise',
    label: 'Wise',
    kind: '实时中间价',
    asOf: r.time,
    fetchedAt: Date.now(),
    url: `https://wise.com/zh-cn/currency-converter/${from.toLowerCase()}-to-${to.toLowerCase()}-rate`,
    notice: '未含汇款手续费；中间价不等于最终到账价。',
  });
}
export type MarketTable = {
  rates: Record<string, number>;
  asOf: number;
  next: number;
  fetchedAt: number;
  offline?: boolean;
};
export async function marketRates(): Promise<MarketTable> {
  const r = await request('market', '/v6/latest/USD');
  if (r.result !== 'success' || r.base_code !== 'USD' || !r.rates || r.rates.USD !== 1)
    throw new Error('每日参考源暂不可用');
  if (Object.values(r.rates).some((x) => typeof x !== 'number' || !Number.isFinite(x) || x <= 0))
    throw new Error('每日参考源数据异常');
  const asOf = r.time_last_update_unix * 1000;
  if (!Number.isFinite(asOf) || asOf > Date.now() + 86400000) throw new Error('每日参考源时间异常');
  return { rates: r.rates, asOf, next: r.time_next_update_unix * 1000, fetchedAt: Date.now() };
}
export function marketQuote(table: MarketTable, from: string, to: string): Quote {
  if (!table.rates[from] || !table.rates[to]) throw new Error('每日参考源未覆盖此币种');
  return validateQuote({
    from,
    to,
    rate: table.rates[to] / table.rates[from],
    source: 'market',
    label: 'ExchangeRate-API',
    kind: '每日参考价',
    asOf: table.asOf,
    fetchedAt: table.fetchedAt,
    url: 'https://www.exchangerate-api.com',
    stale: table.offline,
    notice: table.offline
      ? '连接失败，显示上次每日参考缓存；不是实时价。'
      : '每日更新，不是盘中实时价格；不含手续费。',
  });
}
export async function ecbRate(from: string, to: string): Promise<Quote> {
  const r = await request('ecb', `/v2/rates?base=${from}&quotes=${to}`);
  const row = Array.isArray(r) ? r.find((x) => x.base === from && x.quote === to) : null;
  if (!row) throw new Error('央行参考源未覆盖此货币对');
  return validateQuote({
    from,
    to,
    rate: row.rate,
    source: 'ecb',
    label: 'Frankfurter · 央行参考',
    kind: '每日公布',
    asOf: Date.parse(row.date + 'T00:00:00Z'),
    fetchedAt: Date.now(),
    url: 'https://frankfurter.dev',
    notice: '多家央行及官方机构每日参考数据；日期为公布日，不是实时交易价。',
  });
}
const bocNames: Record<string, string> = {
  阿联酋迪拉姆: 'AED',
  澳大利亚元: 'AUD',
  文莱元: 'BND',
  巴西雷亚尔: 'BRL',
  加拿大元: 'CAD',
  瑞士法郎: 'CHF',
  捷克克朗: 'CZK',
  丹麦克朗: 'DKK',
  欧元: 'EUR',
  英镑: 'GBP',
  港币: 'HKD',
  匈牙利福林: 'HUF',
  印尼卢比: 'IDR',
  印度卢比: 'INR',
  日元: 'JPY',
  韩国元: 'KRW',
  澳门元: 'MOP',
  林吉特: 'MYR',
  挪威克朗: 'NOK',
  新西兰元: 'NZD',
  菲律宾比索: 'PHP',
  卢布: 'RUB',
  沙特里亚尔: 'SAR',
  瑞典克朗: 'SEK',
  新加坡元: 'SGD',
  泰国铢: 'THB',
  土耳其里拉: 'TRY',
  新台币: 'TWD',
  美元: 'USD',
  南非兰特: 'ZAR',
  越南盾: 'VND',
  墨西哥比索: 'MXN',
};
export type BocTable = Record<
  string,
  { buy: number; sell: number; cashBuy: number; cashSell: number; asOf: number }
>;
export function parseBoc(html: string): BocTable {
  const out: BocTable = {};
  for (const m of html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [...m[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map((x) =>
      x[1].replace(/<[^>]*>/g, '').trim(),
    );
    const code = bocNames[cells[0]];
    if (!code || cells.length < 7) continue;
    const date = cells[6].replaceAll('/', '-');
    const asOf = Date.parse(
      (date.includes(' ') ? date : date + ' ' + cells[7]).replace(' ', 'T') + '+08:00',
    );
    if (!Number.isFinite(asOf)) continue;
    out[code] = {
      buy: Number(cells[1]) / 100,
      cashBuy: Number(cells[2]) / 100,
      sell: Number(cells[3]) / 100,
      cashSell: Number(cells[4]) / 100,
      asOf,
    };
  }
  if (Object.keys(out).length < 5) throw new Error('中行牌价页面结构变化，暂时无法读取');
  return out;
}
export function bocQuote(table: BocTable, from: string, to: string): Quote {
  if (from !== 'CNY' && to !== 'CNY') throw new Error('中行牌价支持人民币与外币兑换，请选择 CNY');
  const entry = table[from === 'CNY' ? to : from];
  if (!entry) throw new Error('中行未公布此币种的牌价');
  const rate = from === 'CNY' ? (entry.sell ? 1 / entry.sell : 0) : entry.buy;
  const kind = from === 'CNY' ? '现汇卖出价' : '现汇买入价';
  return validateQuote({
    from,
    to,
    rate,
    source: 'boc',
    label: '中国银行',
    kind,
    asOf: entry.asOf,
    fetchedAt: Date.now(),
    url: 'https://www.boc.cn/sourcedb/whpj/',
    notice:
      from === 'CNY'
        ? '你用人民币买外币，采用银行现汇卖出价；未含汇款费。'
        : '你将外币换成人民币，采用银行现汇买入价；未含汇款费。',
  });
}
export async function bocRates() {
  return parseBoc(await request('boc', '/sourcedb/whpj/', true));
}
export function parseComparison(data: any, from: string, to: string): CompareRow[] {
  if (data.sourceCurrency !== from || data.targetCurrency !== to || !Array.isArray(data.providers))
    throw new Error('比价服务返回的货币对不符');
  const rows: CompareRow[] = [];
  for (const p of data.providers) {
    if (typeof p.name !== 'string' || !Array.isArray(p.quotes)) continue;
    for (const [index, q] of p.quotes.entries()) {
      if (
        ![q.rate, q.fee, q.receivedAmount].every(
          (x) => typeof x === 'number' && Number.isFinite(x),
        ) ||
        q.rate <= 0 ||
        q.fee < 0 ||
        q.receivedAmount < 0
      )
        continue;
      const time = Date.parse(q.dateCollected);
      if (!Number.isFinite(time)) continue;
      rows.push({
        id: `${p.alias}-${index}`,
        name: p.name,
        type: p.type === 'bank' ? '银行' : '汇款平台',
        rate: q.rate,
        fee: q.fee,
        received: q.receivedAmount,
        collectedAt: time,
        payIn: '银行转账',
        payOut: '银行到账',
        sourceCountry: q.sourceCountry ?? undefined,
        targetCountry: q.targetCountry ?? undefined,
        url: `https://wise.com/gb/compare/?sourceCurrency=${from}&targetCurrency=${to}&sendAmount=${encodeURIComponent(data.amount)}`,
      });
    }
  }
  return rows.sort((a, b) => b.received - a.received);
}
export async function comparison(
  from: string,
  to: string,
  amount: number,
  sourceCountry = '',
  targetCountry = '',
) {
  validPair(from, to);
  if (!Number.isFinite(amount) || amount <= 0 || amount > 1e8 || from === to)
    throw new Error('比价需要不同币种，金额应大于 0 且不超过 1 亿');
  if (!/^(?:[A-Z]{2})?$/.test(sourceCountry) || !/^(?:[A-Z]{2})?$/.test(targetCountry))
    throw new Error('无效国家代码');
  const query = new URLSearchParams({
    sourceCurrency: from,
    targetCurrency: to,
    sendAmount: String(amount),
    includeWise: 'true',
    ...(sourceCountry ? { sourceCountry } : {}),
    ...(targetCountry ? { targetCountry } : {}),
  });
  const data = await request('compare', `/2026Q3/comparisons?${query}`);
  return parseComparison(data, from, to);
}
