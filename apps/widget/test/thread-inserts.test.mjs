/**
 * The widget's own thread cards survive a page change (ivy-docs PLN-261119).
 *
 * Run: node --test apps/widget/test/
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSync } from 'esbuild';
import { fileURLToPath } from 'node:url';

const { outputFiles } = buildSync({
  entryPoints: [fileURLToPath(new URL('../src/lib/thread-inserts.ts', import.meta.url))],
  bundle: true,
  format: 'esm',
  write: false,
  platform: 'neutral',
});

/** A fresh module + a fresh storage per case; `broken` makes every storage call throw. */
async function load({ broken = false } = {}) {
  const data = new Map();
  globalThis.sessionStorage = {
    getItem: (k) => { if (broken) throw new Error('blocked'); return data.has(k) ? data.get(k) : null; },
    setItem: (k, v) => { if (broken) throw new Error('blocked'); data.set(k, String(v)); },
    removeItem: (k) => { if (broken) throw new Error('blocked'); data.delete(k); },
  };
  const mod = await import(`data:text/javascript,${encodeURIComponent(outputFiles[0].text)}#${Math.random()}`);
  return { ...mod, data };
}

const CARD = { key: 'contact-1', kind: 'contact', at: 2, asked: 'Contact Support' };

test('cards saved for a conversation come back for the same session and conversation', async () => {
  const m = await load();
  m.saveThreadInserts('tok-A', '42', [CARD]);
  assert.deepEqual(m.loadThreadInserts('tok-A', '42'), [CARD]);
});

test('another conversation, or another session, gets none of them', async () => {
  const m = await load();
  m.saveThreadInserts('tok-A', '42', [CARD]);
  assert.deepEqual(m.loadThreadInserts('tok-A', '43'), []);
  assert.deepEqual(m.loadThreadInserts('tok-B', '42'), []);
});

test('cards added before any conversation exists are kept under "no conversation"', async () => {
  const m = await load();
  m.saveThreadInserts('tok-A', null, [CARD]);
  assert.deepEqual(m.loadThreadInserts('tok-A', null), [CARD]);
  assert.deepEqual(m.loadThreadInserts('tok-A', '42'), []);
});

test('the session token is not written into the storage key', async () => {
  const m = await load();
  m.saveThreadInserts('secret-session-token', '42', [CARD]);
  assert.equal([...m.data.keys()].some((k) => k.includes('secret-session-token')), false);
});

test('saving an empty list, or clearing, removes the entry', async () => {
  const m = await load();
  m.saveThreadInserts('tok-A', '42', [CARD]);
  m.saveThreadInserts('tok-A', '42', []);
  assert.equal(m.data.size, 0);
  m.saveThreadInserts('tok-A', '42', [CARD]);
  m.clearThreadInserts('tok-A');
  assert.equal(m.data.size, 0);
});

test('a day-old entry is ignored', async () => {
  const m = await load();
  m.saveThreadInserts('tok-A', '42', [CARD]);
  const key = [...m.data.keys()][0];
  const stored = JSON.parse(m.data.get(key));
  stored.savedAt = Date.now() - 25 * 3_600_000;
  m.data.set(key, JSON.stringify(stored));
  assert.deepEqual(m.loadThreadInserts('tok-A', '42'), []);
});

test('only the most recent 40 cards are kept', async () => {
  const m = await load();
  const many = Array.from({ length: 60 }, (_, i) => ({ ...CARD, key: `contact-${i + 1}` }));
  m.saveThreadInserts('tok-A', '42', many);
  const back = m.loadThreadInserts('tok-A', '42');
  assert.equal(back.length, 40);
  assert.equal(back[39].key, 'contact-60');
});

test('blocked storage or a corrupt entry means no cards, never an error', async () => {
  const blocked = await load({ broken: true });
  assert.doesNotThrow(() => blocked.saveThreadInserts('tok-A', '42', [CARD]));
  assert.deepEqual(blocked.loadThreadInserts('tok-A', '42'), []);
  assert.doesNotThrow(() => blocked.clearThreadInserts('tok-A'));

  const m = await load();
  m.saveThreadInserts('tok-A', '42', [CARD]);
  m.data.set([...m.data.keys()][0], '{not json');
  assert.deepEqual(m.loadThreadInserts('tok-A', '42'), []);
});
