/**
 * Notification rows: the time wording and the New / Recent groups of IVY PRD
 * v1 slide 9 (which replaced SPEC BR-04 / BR-05), and the status pill code
 * (T02 D3, BUG-011).
 *
 * Run: node --test apps/widget/test/
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSync } from 'esbuild';
import { fileURLToPath } from 'node:url';

async function load(rel) {
  const { outputFiles } = buildSync({
    entryPoints: [fileURLToPath(new URL(rel, import.meta.url))],
    bundle: true,
    format: 'esm',
    write: false,
    platform: 'neutral',
  });
  return import(`data:text/javascript,${encodeURIComponent(outputFiles[0].text)}`);
}

const { noticeTime, groupByRead } = await load('../src/lib/format.ts');
const { noticeStatus } = await load('../../../packages/types/src/common/order-status.ts');

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
const NOW = new Date(Date.UTC(2026, 10, 19, 9, 0));
const ago = (ms) => new Date(NOW.getTime() - ms).toISOString();

test('under a minute: Just now', () => {
  assert.deepEqual(noticeTime(ago(20_000), NOW), { unit: 'justNow' });
  assert.deepEqual(noticeTime(ago(59_999), NOW), { unit: 'justNow' });
});

test('1–59 minutes, 1–23 hours, then days — each rounded down', () => {
  assert.deepEqual(noticeTime(ago(MIN), NOW), { unit: 'minutes', count: 1 });
  assert.deepEqual(noticeTime(ago(59 * MIN + 59_000), NOW), { unit: 'minutes', count: 59 });
  assert.deepEqual(noticeTime(ago(HOUR), NOW), { unit: 'hours', count: 1 });
  assert.deepEqual(noticeTime(ago(2 * HOUR + 59 * MIN), NOW), { unit: 'hours', count: 2 });
  assert.deepEqual(noticeTime(ago(23 * HOUR + 59 * MIN), NOW), { unit: 'hours', count: 23 });
  assert.deepEqual(noticeTime(ago(DAY), NOW), { unit: 'days', count: 1 });
  // The PRD's own example: 47 hours is 1 day ago.
  assert.deepEqual(noticeTime(ago(47 * HOUR), NOW), { unit: 'days', count: 1 });
  assert.deepEqual(noticeTime(ago(48 * HOUR), NOW), { unit: 'days', count: 2 });
  // No dates any more: a month back is still counted in days.
  assert.deepEqual(noticeTime(ago(30 * DAY), NOW), { unit: 'days', count: 30 });
});

test('the PRD example IVY-39891 at 11/19 9:00 AM', () => {
  // Delivered 11/19 7:00, In Transit 11/18 7:00, Confirmed 11/16 2:00 PM (UTC).
  assert.deepEqual(noticeTime(new Date(Date.UTC(2026, 10, 19, 7)).toISOString(), NOW), { unit: 'hours', count: 2 });
  assert.deepEqual(noticeTime(new Date(Date.UTC(2026, 10, 18, 7)).toISOString(), NOW), { unit: 'days', count: 1 });
  assert.deepEqual(noticeTime(new Date(Date.UTC(2026, 10, 16, 14)).toISOString(), NOW), { unit: 'days', count: 2 });
});

test('a clock ahead of ours reads Just now, never a negative age', () => {
  assert.deepEqual(noticeTime(ago(-5 * MIN), NOW), { unit: 'justNow' });
});

test('an unreadable timestamp renders nothing', () => {
  assert.equal(noticeTime('not a date', NOW), null);
});

test('groups: New then Recent, feed order kept inside each, empty groups left out', () => {
  const items = [
    { id: 'a', readAt: null },
    { id: 'b', readAt: '2026-11-18T07:00:00Z' },
    { id: 'c', readAt: null },
    { id: 'd', readAt: '2026-11-16T14:00:00Z' },
  ];
  const isNew = (i) => i.readAt == null;
  assert.deepEqual(
    groupByRead(items, isNew).map((g) => [g.key, g.items.map((i) => i.id)]),
    [
      ['new', ['a', 'c']],
      ['recent', ['b', 'd']],
    ],
  );
  assert.deepEqual(groupByRead(items.filter((i) => i.readAt), isNew).map((g) => g.key), ['recent']);
  assert.deepEqual(groupByRead([], isNew), []);
});

test('groups: a row read while the widget is open stays in New (rule 3)', () => {
  const seenUnread = new Set(['a']);
  const items = [{ id: 'a', readAt: '2026-11-19T08:59:00Z' }, { id: 'b', readAt: '2026-11-18T07:00:00Z' }];
  assert.deepEqual(
    groupByRead(items, (i) => seenUnread.has(i.id)).map((g) => [g.key, g.items.map((i) => i.id)]),
    [
      ['new', ['a']],
      ['recent', ['b']],
    ],
  );
});

test('status pill code: the six API status words, matched exactly', () => {
  assert.equal(noticeStatus('Confirmed'), 'confirmed');
  assert.equal(noticeStatus('In Transit'), 'in_transit');
  assert.equal(noticeStatus(' in  transit '), 'in_transit');
  assert.equal(noticeStatus('Delivered'), 'delivered');
  assert.equal(noticeStatus('Review'), 'review');
  assert.equal(noticeStatus('Pending payment'), 'pending_payment');
  assert.equal(noticeStatus('Cancel requested'), 'cancel_requested');
});

test('status pill code: no guessing from look-alike wording (BUG-011)', () => {
  for (const s of ['Delivery failed', 'Undelivered', 'Not confirmed', 'Shipped', '', null, undefined]) {
    assert.equal(noticeStatus(s), null, String(s));
  }
});
