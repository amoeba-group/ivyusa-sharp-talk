/**
 * Which chips each list tab shows (PLN-260923 P1, ivy-docs T02).
 *
 * A tenant with only one list tab (ivyusa) gets the design's single bar —
 * Order · Delivery · Promo · Review — and Inquiries only when it runs an issue
 * workflow. Tenants with both list tabs keep their split bars unchanged.
 *
 * Run: node --test apps/widget/test/
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSync } from 'esbuild';
import { fileURLToPath } from 'node:url';

// tab-chips.ts imports only a TYPE from the store, so bundling it alone is
// enough; esbuild drops the type import.
const { outputFiles } = buildSync({
  entryPoints: [fileURLToPath(new URL('../src/components/notifications/tab-chips.ts', import.meta.url))],
  bundle: true,
  format: 'esm',
  write: false,
  platform: 'neutral',
});
const mod = await import(`data:text/javascript,${encodeURIComponent(outputFiles[0].text)}`);
const { chipsFor, defaultChip, chipBelongsTo, orderFeedRows } = mod;

const keys = (chips) => chips.map((c) => c.key);
const labels = (chips) => chips.map((c) => c.labelKey);
const SINGLE = ['notifications', 'chat'];
const SPLIT = ['notifications', 'orders', 'chat'];

test('single list tab: the design bar Order · Delivery · Promo · Review, starting on Order', () => {
  const chips = chipsFor('notifications', SINGLE);
  assert.deepEqual(keys(chips), ['order', 'shipping', 'event', 'review']);
  assert.deepEqual(labels(chips), [
    'notifications.filters.order',
    'notifications.filters.shipping',
    'notifications.filters.promo',
    'notifications.filters.review',
  ]);
  assert.equal(defaultChip('notifications', SINGLE), 'order');
});

test('single list tab: no All, no order-list chip — a stored "all" falls back to Order', () => {
  for (const gone of ['all', 'orders', 'payment']) {
    assert.equal(chipBelongsTo(gone, 'notifications', SINGLE), false, gone);
  }
});

test('single list tab works the same when the one list tab is Orders', () => {
  assert.deepEqual(keys(chipsFor('orders', ['orders', 'chat'])), ['order', 'shipping', 'event', 'review']);
});

test('single list tab: Inquiries only for tenants with an issue workflow', () => {
  assert.deepEqual(keys(chipsFor('notifications', SINGLE, { inquiries: true })).at(-1), 'inquiries');
  assert.equal(chipBelongsTo('inquiries', 'notifications', SINGLE), false);
  assert.equal(chipBelongsTo('inquiries', 'notifications', SINGLE, { inquiries: true }), true);
});

test('both list tabs: split bars unchanged, Orders label kept', () => {
  assert.deepEqual(keys(chipsFor('notifications', SPLIT)), ['all', 'event']);
  assert.equal(chipsFor('notifications', SPLIT)[1].labelKey, 'notifications.filters.event');
  const orders = chipsFor('orders', SPLIT);
  assert.deepEqual(keys(orders), ['orders', 'shipping', 'review', 'inquiries']);
  assert.equal(orders[0].labelKey, 'notifications.filters.orders');
});

test('the Order chip shows payment and shipping notices only', () => {
  const rows = ['payment', 'shipping', 'event', 'review', 'chat'].map((category, i) => ({ id: String(i), category }));
  assert.deepEqual(orderFeedRows(rows).map((r) => r.category), ['payment', 'shipping']);
});
