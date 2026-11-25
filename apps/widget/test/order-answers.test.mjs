/**
 * Payment check / Delivery inquiry (IVY PRD v1 C-01, PLN-261125 §2.5): which
 * order the card is about, and what it says about the payment.
 *
 * Run: node --test apps/widget/test/
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSync } from 'esbuild';
import { fileURLToPath } from 'node:url';

const { outputFiles } = buildSync({
  entryPoints: [fileURLToPath(new URL('../src/lib/order-answers.ts', import.meta.url))],
  bundle: true,
  format: 'esm',
  write: false,
  platform: 'neutral',
});
const { latestOrder, deliveryOrder, paymentState, deliveryStage } = await import(
  `data:text/javascript,${encodeURIComponent(outputFiles[0].text)}`
);

const order = (id, statusInternal, orderedAt, statusUi = null) => ({ id, statusInternal, statusUi, orderedAt, createdAt: orderedAt });
const ORDERS = [
  order('a', 'delivered', '2026-11-20T10:00:00Z'),
  order('b', 'shipping', '2026-11-22T10:00:00Z'),
  order('c', 'paid', '2026-11-24T10:00:00Z'),
];

test('latest order: the newest by placing time, whatever the list order', () => {
  assert.equal(latestOrder(ORDERS).id, 'c');
  assert.equal(latestOrder([...ORDERS].reverse()).id, 'c');
  assert.equal(latestOrder([]), null);
});

test('delivery inquiry: the newest order on its way, else the newest order', () => {
  assert.equal(deliveryOrder(ORDERS).id, 'b');
  assert.equal(deliveryOrder(ORDERS.filter((o) => o.id !== 'b')).id, 'c');
  assert.equal(deliveryOrder([]), null);
});

test('payment state from the status we store', () => {
  assert.equal(paymentState({ statusInternal: 'paid' }), 'paid');
  assert.equal(paymentState({ statusInternal: 'shipping' }), 'paid');
  assert.equal(paymentState({ statusInternal: 'delivered' }), 'paid');
  assert.equal(paymentState({ statusInternal: 'pending_payment' }), 'pending');
  assert.equal(paymentState({ statusInternal: 'cancelled' }), 'cancelled');
  assert.equal(paymentState({ statusInternal: 'refunded' }), 'refunded');
  assert.equal(paymentState({ statusInternal: null }), 'paid');
});

test('delivery stage', () => {
  assert.equal(deliveryStage({ statusInternal: 'delivered' }), 'delivered');
  assert.equal(deliveryStage({ statusInternal: 'shipping' }), 'inTransit');
  assert.equal(deliveryStage({ statusInternal: 'paid' }), 'preparing');
  assert.equal(deliveryStage({ statusInternal: 'cancelled' }), 'preparing');
});
