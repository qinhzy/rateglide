import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  getQuote,
  addHistory,
  handleMessage,
  getMarket,
  peekQuote,
  timing,
} from '../src/core/service';
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
test('auto mode names Wise when the daily fallback cannot help either', async () => {
  globalThis.fetch = async (input) =>
    String(input).includes('wise.com')
      ? new Response('', { status: 503 })
      : Response.json({
          result: 'success',
          base_code: 'USD',
          rates: { USD: 1, CNY: 7 },
          time_last_update_unix: Date.now() / 1000,
          time_next_update_unix: Date.now() / 1000 + 86400,
        });
  await assert.rejects(getQuote('USD', 'KRW', 'auto'), (e: Error) => {
    assert.match(e.message, /^Wise 暂不可用或不支持此币种。/);
    assert.match(e.message, /每日参考源未覆盖此币种/);
    return true;
  });
});
const daily = (asOf: number, cny = 7) =>
  Response.json({
    result: 'success',
    base_code: 'USD',
    rates: { USD: 1, CNY: cny },
    time_last_update_unix: asOf / 1000,
    time_next_update_unix: asOf / 1000 + 86400,
  });
test('a slow Wise answer shows the daily reference meanwhile, then Wise', async () => {
  timing.wiseSoftTimeout = 20;
  let release!: () => void;
  const wiseArrives = new Promise<void>((resolve) => (release = resolve));
  globalThis.fetch = async (input) => {
    if (!String(input).includes('wise.com')) return daily(Date.now() - 3600000);
    await wiseArrives;
    return Response.json({ source: 'USD', target: 'CNY', value: 7.2, time: Date.now() });
  };
  try {
    const first = await getQuote('USD', 'CNY', 'auto');
    assert.equal(first.source, 'market');
    assert.equal(first.provisional, true);
    assert.match(first.notice!, /Wise 响应较慢/);
    // The provisional quote is not cached, so it cannot outlive Wise's answer.
    assert.equal(await read('quote:auto:USD:CNY', null), null);
    release();
    await new Promise((resolve) => setTimeout(resolve, 30));
    const second = await getQuote('USD', 'CNY', 'auto');
    assert.equal(second.source, 'wise');
    assert.equal(second.rate, 7.2);
    assert.ok(!second.provisional);
  } finally {
    timing.wiseSoftTimeout = 2500;
  }
});
test('a slow Wise answer is awaited when the daily reference is unavailable too', async () => {
  timing.wiseSoftTimeout = 10;
  globalThis.fetch = async (input) => {
    if (!String(input).includes('wise.com')) return new Response('', { status: 503 });
    await new Promise((resolve) => setTimeout(resolve, 40));
    return Response.json({ source: 'USD', target: 'CNY', value: 7.3, time: Date.now() });
  };
  try {
    const q = await getQuote('USD', 'CNY', 'auto');
    assert.equal(q.source, 'wise');
    assert.equal(q.rate, 7.3);
  } finally {
    timing.wiseSoftTimeout = 2500;
  }
});
test('peeking returns a saved quote without any request', async () => {
  globalThis.fetch = async () => {
    throw new Error('unexpected network');
  };
  assert.equal(await peekQuote('USD', 'CNY'), null);
  await write('quote:auto:USD:CNY', {
    from: 'USD',
    to: 'CNY',
    source: 'wise',
    rate: 7.1,
    label: 'Wise',
    kind: '实时中间价',
    asOf: Date.now() - 600000,
    fetchedAt: Date.now() - 600000,
    url: 'https://wise.com',
  });
  const q = await peekQuote('USD', 'CNY');
  assert.equal(q?.rate, 7.1);
  assert.equal(q?.cached, true);
  assert.equal(q?.stale, true);
  assert.equal(await peekQuote('USD', 'USD'), null);
});
test('the previous daily table is kept for daily changes', async () => {
  const yesterday = Date.now() - 30 * 3600000,
    today = Date.now() - 3600000;
  globalThis.fetch = async () => daily(yesterday, 7);
  const first = await getMarket();
  assert.equal(first.previous, undefined);
  globalThis.fetch = async () => daily(today, 7.1);
  const second = await getMarket(true);
  assert.equal(second.rates.CNY, 7.1);
  assert.equal(second.previous?.rates.CNY, 7);
  assert.equal(second.previous?.asOf, yesterday);
  // An hourly check that finds the same publication leaves the previous table alone.
  const third = await getMarket(true);
  assert.equal(third.previous?.asOf, yesterday);
});
