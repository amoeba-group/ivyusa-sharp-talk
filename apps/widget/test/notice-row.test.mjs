/**
 * Notification rows (ivy-docs T02): the BR-05 time wording, the Today's /
 * Yesterday's grouping, and the status pill code (D3, BUG-011).
 *
 * Dates are built with the local-time constructor, so the calendar cases hold
 * in whatever time zone the runner uses — which is the point: days are the
 * shopper's own calendar days.
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

const { noticeTime, groupByDate, shortDate } = await load('../src/lib/format.ts');
const { noticeStatus } = await load('../../../packages/types/src/common/order-status.ts');

const MIN = 60_000;
const HOUR = 60 * MIN;
// 2026-11-11 15:30 local.
const NOW = new Date(2026, 10, 11, 15, 30);
const at = (y, m, d, h = 12, min = 0) => new Date(y, m, d, h, min).toISOString();
const ago = (ms) => new Date(NOW.getTime() - ms).toISOString();

test('today: Just now, then minutes, then hours', () => {
  assert.deepEqual(noticeTime(ago(20_000), NOW), { unit: 'justNow' });
  assert.deepEqual(noticeTime(ago(59_999), NOW), { unit: 'justNow' });
  assert.deepEqual(noticeTime(ago(MIN), NOW), { unit: 'minutes', count: 1 });
  assert.deepEqual(noticeTime(ago(10 * MIN), NOW), { unit: 'minutes', count: 10 });
  assert.deepEqual(noticeTime(ago(59 * MIN), NOW), { unit: 'minutes', count: 59 });
  assert.deepEqual(noticeTime(ago(HOUR), NOW), { unit: 'hours', count: 1 });
  assert.deepEqual(noticeTime(at(2026, 10, 11, 0, 5), NOW), { unit: 'hours', count: 15 });
});

test('a clock ahead of ours reads Just now, never a negative age', () => {
  assert.deepEqual(noticeTime(ago(-5 * MIN), NOW), { unit: 'justNow' });
});

test('yesterday is the calendar day, not "24 hours ago"', () => {
  // 15h30m ago, but on yesterday's date.
  assert.deepEqual(noticeTime(at(2026, 10, 10, 23, 59), NOW), { unit: 'yesterday' });
  assert.deepEqual(noticeTime(at(2026, 10, 10, 0, 1), NOW), { unit: 'yesterday' });
});

test('minutes win over the calendar just after midnight', () => {
  const justAfterMidnight = new Date(2026, 10, 11, 0, 3);
  const beforeMidnight = new Date(2026, 10, 10, 23, 58).toISOString();
  assert.deepEqual(noticeTime(beforeMidnight, justAfterMidnight), { unit: 'minutes', count: 5 });
});

test('2–6 days: "{n} days ago"; from 7 days: the date (Q-02)', () => {
  assert.deepEqual(noticeTime(at(2026, 10, 9), NOW), { unit: 'days', count: 2 });
  assert.deepEqual(noticeTime(at(2026, 10, 5), NOW), { unit: 'days', count: 6 });
  assert.deepEqual(noticeTime(at(2026, 10, 4), NOW), { unit: 'date', sameYear: true });
  assert.deepEqual(noticeTime(at(2025, 11, 30), NOW), { unit: 'date', sameYear: false });
});

test('an unreadable timestamp renders nothing', () => {
  assert.equal(noticeTime('not a date', NOW), null);
});

test('short date: "Nov 3" this year, with the year before it', () => {
  assert.equal(shortDate(at(2026, 10, 3), 'en'), 'Nov 3');
  assert.equal(shortDate(at(2025, 10, 3), 'en', true), 'Nov 3, 2025');
});

test("groups: Today's, Yesterday's, then one group per older date, in feed order", () => {
  const items = [
    { id: 'a', createdAt: ago(20_000) },
    { id: 'b', createdAt: ago(10 * MIN) },
    { id: 'c', createdAt: at(2026, 10, 10, 13) },
    { id: 'd', createdAt: at(2026, 10, 7) },
  ];
  const groups = groupByDate(items, 'en', NOW);
  assert.deepEqual(
    groups.map((g) => [g.relative, g.items.map((i) => i.id)]),
    [
      ['today', ['a', 'b']],
      ['yesterday', ['c']],
      [null, ['d']],
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
