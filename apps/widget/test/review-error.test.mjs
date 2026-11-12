/**
 * Failed review saves (ivy-docs T06 D3, BUG-009): which message the shopper gets.
 *
 * Run: node --test apps/widget/test/*.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSync } from 'esbuild';
import { fileURLToPath } from 'node:url';

const { outputFiles } = buildSync({
  entryPoints: [fileURLToPath(new URL('../src/lib/review-error.ts', import.meta.url))],
  bundle: true,
  format: 'esm',
  write: false,
  platform: 'neutral',
});
const { reviewErrorKey } = await import(`data:text/javascript,${encodeURIComponent(outputFiles[0].text)}`);

test('moderation refusal (E4002) tells the shopper what to change', () => {
  assert.equal(reviewErrorKey(Object.assign(new Error('Message blocked'), { code: 'E4002' })), 'review.blocked');
});

test('anything else is the plain retry message', () => {
  for (const err of [new Error('Network Error'), Object.assign(new Error('x'), { code: 'E9001' }), null, undefined, 'boom']) {
    assert.equal(reviewErrorKey(err), 'review.saveFailed');
  }
});
