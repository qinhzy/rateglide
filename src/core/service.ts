import { getSettings, saveSettings, read, write, ext } from './storage';
import {
  wiseRate,
  ecbRate,
  marketRates,
  marketQuote,
  bocRates,
  bocQuote,
  comparison,
  validPair,
  type MarketTable,
  type BocTable,
} from './providers';
import { cardRate, cardAsQuote, revolutRate, revolutAsQuote, validateCardInput } from './payments';
import type { CardInput, CardQuote, Quote, Source, Settings, HistoryEntry } from './types';
const pending = new Map<string, Promise<any>>();
async function coalesce<T>(key: string, fn: () => Promise<T>): Promise<T> {
  if (pending.has(key)) return pending.get(key);
  const p = fn();
  pending.set(key, p);
  try {
    return await p;
  } finally {
    pending.delete(key);
  }
}
const ttl: Record<Exclude<Source, 'auto'>, number> = {
  wise: 60000,
  market: 3600000,
  ecb: 3600000,
  boc: 300000,
  visa: 300000,
  mastercard: 300000,
  revolut: 60000,
};
export async function getMarket(force = false) {
  return coalesce('market', async () => {
    const table = await read<MarketTable | null>('market', null);
    if (table && Date.now() - table.fetchedAt < 3600000 && !force) return table;
    try {
      const r = await marketRates();
      await write('market', r);
      return r;
    } catch (e) {
      if (table && Date.now() - table.asOf < 7 * 86400000) return { ...table, offline: true };
      throw e;
    }
  });
}
export async function getQuote(
  from: string,
  to: string,
  source: Source = 'auto',
  force = false,
): Promise<Quote> {
  validPair(from, to);
  if (!['auto', 'wise', 'market', 'ecb', 'boc', 'visa', 'mastercard', 'revolut'].includes(source))
    throw new Error('无效的汇率来源');
  if (from === to)
    return {
      from,
      to,
      rate: 1,
      source: 'wise',
      label: '同币种',
      kind: '等值换算',
      asOf: Date.now(),
      fetchedAt: Date.now(),
      url: 'https://wise.com',
    };
  return coalesce(`${from}-${to}-${source}`, async () => {
    const key = `quote:${source}:${from}:${to}`;
    const cache = await read<Quote | null>(key, null);
    const now = Date.now();
    if (
      cache &&
      !force &&
      now - cache.fetchedAt < ttl[cache.source] &&
      !(source === 'auto' && cache.source !== 'wise' && now - cache.fetchedAt > 60000)
    )
      return {
        ...cache,
        cached: true,
        stale:
          !!cache.stale ||
          now - cache.asOf >
            (['wise', 'revolut'].includes(cache.source)
              ? 300000
              : cache.source === 'boc'
                ? 86400000
                : 3 * 86400000),
      };
    try {
      let q: Quote;
      if (source === 'visa' || source === 'mastercard')
        q = cardAsQuote(
          await getCardQuote({ network: source, from, to, amount: 1, bankFee: 0, date: '' }, force),
        );
      else if (source === 'revolut') q = revolutAsQuote(await revolutRate(from, to, 1));
      else if (source === 'market') q = marketQuote(await getMarket(force), from, to);
      else if (source === 'ecb') q = await ecbRate(from, to);
      else if (source === 'boc') {
        let table = await read<{ data: BocTable; time: number } | null>('boc', null);
        if (!table || force || now - table.time > 300000) {
          table = { data: await bocRates(), time: now };
          await write('boc', table);
        }
        q = bocQuote(table.data, from, to);
      } else {
        try {
          q = await wiseRate(from, to);
        } catch (e) {
          if (source !== 'auto') throw e;
          q = marketQuote(await getMarket(force), from, to);
          q.notice = 'Wise 暂不可用或不支持此币种，已使用每日参考价。' + q.notice;
        }
      }
      q.stale =
        !!q.stale ||
        now - q.asOf >
          (['wise', 'revolut'].includes(q.source)
            ? 300000
            : q.source === 'boc'
              ? 86400000
              : 3 * 86400000);
      await write(key, q);
      await pruneQuoteCache(key);
      return q;
    } catch (e) {
      if (cache && now - cache.asOf < 7 * 86400000)
        return {
          ...cache,
          cached: true,
          stale: true,
          notice: '最新请求失败，显示上次缓存；请勿当作实时价。',
        };
      throw e;
    }
  });
}
async function pruneQuoteCache(key: string) {
  const keys = await read<string[]>('quoteKeys', []);
  if (keys.includes(key)) return;
  keys.push(key);
  if (keys.length > 120) {
    const removed = keys.splice(0, keys.length - 120);
    if (ext) await ext.storage.local.remove(removed);
    else removed.forEach((k) => localStorage.removeItem('huijian:' + k));
  }
  await write('quoteKeys', keys);
}
export async function addHistory(entry: Omit<HistoryEntry, 'id' | 'time'>) {
  if (!(await getSettings()).rememberHistory) return;
  const data = await read<HistoryEntry[]>('history', []);
  data.unshift({ ...entry, id: crypto.randomUUID(), time: Date.now() });
  await write('history', data.slice(0, 50));
}
export async function handleMessage(m: any) {
  switch (m?.type) {
    case 'settings':
      return getSettings();
    case 'saveSettings':
      return saveSettings(m.patch as Partial<Settings>);
    case 'quote':
      return getQuote(m.from, m.to, m.source, m.force);
    case 'market':
      return getMarket(m.force);
    case 'compare':
      return coalesce(
        `compare:${m.from}:${m.to}:${m.amount}:${m.sourceCountry}:${m.targetCountry}`,
        () => comparison(m.from, m.to, m.amount, m.sourceCountry, m.targetCountry),
      );
    case 'card':
      return getCardQuote(m.input, m.force);
    case 'revolut':
      return coalesce(`revolut:${m.from}:${m.to}:${m.amount}:${m.country}`, () =>
        revolutRate(m.from, m.to, m.amount, m.country),
      );
    case 'history':
      return read<HistoryEntry[]>('history', []);
    case 'clearHistory':
      await write('history', []);
      return true;
    case 'addHistory':
      await addHistory(m.entry);
      return true;
    default:
      throw new Error('未知请求');
  }
}

export async function getCardQuote(input: CardInput, force = false): Promise<CardQuote> {
  validateCardInput(input);
  const key = `card:${input.network}:${input.from}:${input.to}:${input.amount}:${input.bankFee}:${input.date || 'latest'}`;
  return coalesce(key, async () => {
    const cache = await read<CardQuote | null>(key, null),
      now = Date.now();
    if (cache && !force && now - cache.fetchedAt < 300000) return { ...cache, cached: true };
    try {
      const q = await cardRate(input);
      await write(key, q);
      await pruneQuoteCache(key);
      return q;
    } catch (e) {
      if (cache && now - cache.fetchedAt < 7 * 86400000)
        return { ...cache, cached: true, stale: true };
      throw e;
    }
  });
}
