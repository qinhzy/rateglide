import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { getQuote, addHistory, handleMessage } from '../src/core/service';
import { write, saveSettings, read } from '../src/core/storage';
const memory = new Map<string, string>();
const oldFetch = globalThis.fetch;
Object.defineProperty(globalThis, 'localStorage', {
  value: {
    getItem: (k: string) => memory.get(k) ?? null,
    setItem: (k: string, v: string) => memory.set(k, v),
    removeItem: (k: string) => memory.delete(k),
  },
  configurable: true,
});
beforeEach(() => {
  memory.clear();
});
afterEach(() => {
  globalThis.fetch = oldFetch;
});
test('same currency returns one without a network call', async () => {
  globalThis.fetch = async () => {
    throw new Error('unexpected');
  };
  assert.equal((await getQuote('USD', 'USD')).rate, 1);
});
test('concurrent identical quotes share one request', async () => {
  let n = 0;
  globalThis.fetch = async () => {
    n++;
    return Response.json({ source: 'USD', target: 'CNY', value: 7.2, time: Date.now() });
  };
  const [a, b] = await Promise.all([
    getQuote('USD', 'CNY', 'wise'),
    getQuote('USD', 'CNY', 'wise'),
  ]);
  assert.equal(n, 1);
  assert.equal(a.rate, b.rate);
});
test('one-minute cached Wise result reused', async () => {
  let n = 0;
  globalThis.fetch = async () => {
    n++;
    return Response.json({ source: 'USD', target: 'CNY', value: 7, time: Date.now() });
  };
  await getQuote('USD', 'CNY', 'wise');
  assert.equal((await getQuote('USD', 'CNY', 'wise')).cached, true);
  assert.equal(n, 1);
});
test('cached offline market quote retains its stale warning', async () => {
  await write('quote:market:USD:CNY', {
    from: 'USD',
    to: 'CNY',
    source: 'market',
    rate: 7,
    label: '国际市场',
    kind: '每日参考价',
    asOf: Date.now() - 3600000,
    fetchedAt: Date.now(),
    stale: true,
    notice: '断网缓存',
    url: 'https://www.exchangerate-api.com',
  });
  globalThis.fetch = async () => {
    throw new Error('unexpected network');
  };
  const q = await getQuote('USD', 'CNY', 'market');
  assert.equal(q.stale, true);
  assert.equal(q.cached, true);
  assert.equal(q.notice, '断网缓存');
});
test('network failure shows explicitly stale previous quote', async () => {
  await write('quote:wise:USD:CNY', {
    from: 'USD',
    to: 'CNY',
    source: 'wise',
    rate: 7,
    label: 'Wise',
    kind: '实时中间价',
    asOf: Date.now() - 3600000,
    fetchedAt: Date.now() - 3600000,
    url: 'https://wise.com',
  });
  globalThis.fetch = async () => {
    throw new Error('offline');
  };
  const q = await getQuote('USD', 'CNY', 'wise', true);
  assert.equal(q.stale, true);
  assert.equal(q.cached, true);
  assert.match(q.notice!, /失败/);
});
test('quotes older than seven days are not reused', async () => {
  await write('quote:wise:USD:CNY', {
    from: 'USD',
    to: 'CNY',
    source: 'wise',
    rate: 7,
    asOf: Date.now() - 8 * 86400000,
    fetchedAt: Date.now() - 8 * 86400000,
  });
  globalThis.fetch = async () => {
    throw new Error('offline');
  };
  await assert.rejects(getQuote('USD', 'CNY', 'wise'));
});
test('explicit Wise selection cannot silently become market', async () => {
  globalThis.fetch = async () => new Response('', { status: 503 });
  await assert.rejects(getQuote('USD', 'CNY', 'wise'));
});
test('auto fallback explains daily data and preserves its date', async () => {
  const day = Date.now() - 12 * 3600000;
  globalThis.fetch = async (input) =>
    String(input).includes('wise.com')
      ? new Response('', { status: 503 })
      : Response.json({
          result: 'success',
          base_code: 'USD',
          rates: { USD: 1, CNY: 7 },
          time_last_update_unix: day / 1000,
          time_next_update_unix: (day + 86400000) / 1000,
        });
  const q = await getQuote('USD', 'CNY', 'auto');
  assert.equal(q.source, 'market');
  assert.equal(q.asOf, day);
  assert.match(q.notice!, /每日/);
});
test('history remains off until opted in', async () => {
  const entry = { amount: 100, from: 'USD', to: 'CNY', result: 700, source: 'Wise' };
  await addHistory(entry);
  assert.deepEqual(await read('history', []), []);
  await saveSettings({ rememberHistory: true });
  await addHistory(entry);
  assert.equal((await read<any[]>('history', [])).length, 1);
});
test('history is bounded and can be cleared', async () => {
  await saveSettings({ rememberHistory: true });
  for (let i = 0; i < 55; i++)
    await addHistory({ amount: i, from: 'USD', to: 'CNY', result: i * 7, source: 'Wise' });
  assert.equal((await read<any[]>('history', [])).length, 50);
  await handleMessage({ type: 'clearHistory' });
  assert.equal((await read<any[]>('history', [])).length, 0);
});
