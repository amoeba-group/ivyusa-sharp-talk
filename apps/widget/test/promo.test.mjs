/**
 * Promo rows (ivy-docs T05 D3): which kind a row is, and which links it may open.
 *
 * Run: node --test apps/widget/test/*.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSync } from 'esbuild';
import { fileURLToPath } from 'node:url';

const { outputFiles } = buildSync({
  entryPoints: [fileURLToPath(new URL('../src/lib/promo.ts', import.meta.url))],
  bundle: true,
  format: 'esm',
  write: false,
  platform: 'neutral',
});
const { promoKind, safeLink } = await import(`data:text/javascript,${encodeURIComponent(outputFiles[0].text)}`);

test('the API kind wins on promo rows', () => {
  assert.equal(promoKind({ category: 'event', kind: 'coupon', linkUrl: 'https://ivyusa.com/x' }), 'coupon');
  assert.equal(promoKind({ category: 'event', kind: 'event', linkUrl: null }), 'event');
});

test('rows sent before T05 fall back to the link guess', () => {
  assert.equal(promoKind({ category: 'event', kind: null, linkUrl: 'https://ivyusa.com/x' }), 'event');
  assert.equal(promoKind({ category: 'event', linkUrl: null }), 'coupon');
  assert.equal(promoKind({ category: 'event', kind: 'bogus', linkUrl: null }), 'coupon');
});

test('only event rows are promos', () => {
  for (const category of ['payment', 'shipping', 'review', 'chat']) {
    assert.equal(promoKind({ category, kind: 'coupon', linkUrl: 'https://x.test' }), null);
  }
});

test('links: https only, anything else is no link', () => {
  assert.equal(safeLink('https://ivyusa.com/collections/mad-shade'), 'https://ivyusa.com/collections/mad-shade');
  assert.equal(safeLink(' https://ivyusa.com/a '), 'https://ivyusa.com/a');
  for (const bad of ['http://ivyusa.com', 'javascript:alert(1)', 'data:text/html,x', '/collections/x', 'not a url', '', null, undefined]) {
    assert.equal(safeLink(bad), null, String(bad));
  }
});
