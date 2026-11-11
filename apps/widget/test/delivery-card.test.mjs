/**
 * Delivery cards (ivy-docs T03, SCR-IVY-05, BR-06): the state of each stepper
 * step, and the pill status the card shows, so the stepper, the pill and the
 * message cannot disagree.
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

const { deliveryStepState, isDeliveredStep, deliveryCardStatus } = await load('../src/lib/delivery.ts');

const states = (stepIndex, count = 4) =>
  Array.from({ length: count }, (_, i) => deliveryStepState(i, stepIndex, count));

test('in transit (step 3 of 4): done, done, current, todo — TC-03-03', () => {
  assert.deepEqual(states(2), ['done', 'done', 'current', 'todo']);
});

test('delivered is an end state: every step done — TC-03-04', () => {
  assert.deepEqual(states(3), ['done', 'done', 'done', 'done']);
  assert.deepEqual(states(9), ['done', 'done', 'done', 'done']);
});

test('first and second step', () => {
  assert.deepEqual(states(0), ['current', 'todo', 'todo', 'todo']);
  assert.deepEqual(states(1), ['done', 'current', 'todo', 'todo']);
});

test('no tracking yet (-1): nothing reached', () => {
  assert.deepEqual(states(-1), ['todo', 'todo', 'todo', 'todo']);
});

test('the step count is data, not the design\'s four', () => {
  assert.deepEqual(states(1, 3), ['done', 'current', 'todo']);
  assert.deepEqual(states(2, 3), ['done', 'done', 'done']);
  assert.equal(isDeliveredStep(0, 0), false, 'no steps is never delivered');
});

test('pill follows the tracking step once it has loaded', () => {
  const shipping = { statusInternal: 'shipping', statusUi: 'In Transit' };
  const delivered = { statusInternal: 'delivered', statusUi: 'Delivered' };
  const steps = ['a', 'b', 'c', 'd'];
  assert.equal(deliveryCardStatus(shipping, { stepIndex: 2, steps }, 4), 'in_transit');
  // The order row lags the fulfillment: the stepper says delivered, so does the pill.
  assert.equal(deliveryCardStatus(shipping, { stepIndex: 3, steps }, 4), 'delivered');
  // …and the other way round.
  assert.equal(deliveryCardStatus(delivered, { stepIndex: 2, steps }, 4), 'in_transit');
  // A payload without steps uses the fallback labels' count.
  assert.equal(deliveryCardStatus(shipping, { stepIndex: 3, steps: [] }, 4), 'delivered');
});

test('before tracking loads, the pill comes from the order status', () => {
  assert.equal(deliveryCardStatus({ statusInternal: 'delivered' }, undefined, 4), 'delivered');
  assert.equal(deliveryCardStatus({ statusInternal: 'shipping' }, null, 4), 'in_transit');
  assert.equal(deliveryCardStatus({ statusInternal: null, statusUi: 'Delivered' }, undefined, 4), 'delivered');
});
