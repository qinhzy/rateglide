import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSync } from 'esbuild';
import { runInNewContext } from 'node:vm';

// Exercise the registered listener from the real content script, including its
// timer scheduling, without fetching rates or interacting with a browser profile.
const script = buildSync({
  entryPoints: ['src/content/index.ts'],
  bundle: true,
  write: false,
  format: 'iife',
  loader: { '.css': 'text' },
}).outputFiles[0].text;
function setup() {
  const listeners = new Map<string, (event: unknown) => void>();
  const scheduled: unknown[] = [];
  const cleared: unknown[] = [];
  runInNewContext(script, {
    chrome: {
      runtime: {
        id: 'test',
        sendMessage: async () => ({ ok: false }),
        onMessage: { addListener() {} },
      },
      storage: { onChanged: { addListener() {} } },
    },
    document: {
      addEventListener: (type: string, listener: (event: unknown) => void) =>
        listeners.set(type, listener),
    },
    window: { addEventListener() {} },
    setTimeout: (callback: unknown, delay: number) => {
      scheduled.push({ callback, delay });
      return scheduled.length;
    },
    clearTimeout: (timer: unknown) => cleared.push(timer),
  });
  return { keyup: listeners.get('keyup')!, scheduled, cleared };
}

test('plain DOM keyup event does not throw or schedule selection capture', () => {
  const { keyup, scheduled } = setup();
  assert.doesNotThrow(() => keyup(new Event('keyup')));
  assert.equal(scheduled.length, 0);
});

test('missing, null and non-string key values are ignored', () => {
  const { keyup, scheduled } = setup();
  for (const key of [
    undefined,
    null,
    0,
    42,
    false,
    {},
    [],
    {
      startsWith() {
        throw new Error('must not call');
      },
    },
  ]) {
    assert.doesNotThrow(() => keyup({ key }));
  }
  assert.equal(scheduled.length, 0);
});

test('Shift and all arrow keys still schedule and debounce selection capture', () => {
  const { keyup, scheduled, cleared } = setup();
  for (const key of ['Shift', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'])
    keyup({ key, altKey: false });
  assert.equal(scheduled.length, 5);
  assert.deepEqual(cleared, [undefined, 1, 2, 3, 4]);
  assert.ok(scheduled.every((item) => (item as { delay: number }).delay === 40));
});

test('typing, empty keys and non-selection shortcuts do not schedule capture', () => {
  const { keyup, scheduled } = setup();
  for (const key of ['', 'a', 'Enter', 'Tab', 'Escape', 'Alt', 'Control', 'Meta', 'Unidentified'])
    keyup({ key, altKey: false });
  assert.equal(scheduled.length, 0);
});

test('malformed event between valid keys does not cancel pending selection capture', () => {
  const { keyup, scheduled, cleared } = setup();
  keyup({ key: 'Shift', altKey: true });
  keyup(new Event('keyup'));
  assert.equal(scheduled.length, 1);
  assert.deepEqual(cleared, [undefined]);
  keyup({ key: 'ArrowRight', altKey: true });
  assert.equal(scheduled.length, 2);
  assert.deepEqual(cleared, [undefined, 1]);
});
