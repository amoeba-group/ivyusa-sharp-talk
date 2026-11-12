/**
 * Order Detail address lines (ivy-docs T04 D2, Figma 1006:4282).
 *
 * Run: node --test apps/widget/test/*.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSync } from 'esbuild';
import { fileURLToPath } from 'node:url';

// address.ts imports only TYPES, so it bundles on its own.
const { outputFiles } = buildSync({
  entryPoints: [fileURLToPath(new URL('../src/lib/address.ts', import.meta.url))],
  bundle: true,
  format: 'esm',
  write: false,
  platform: 'neutral',
});
const { addressLines, countryName, displayOrderNumber } = await import(
  `data:text/javascript,${encodeURIComponent(outputFiles[0].text)}`
);

const HARBOR = {
  name: 'Hyein Kim',
  address1: '25 HARBOR PARK DR',
  address2: null,
  city: 'PORT WASHINGTON',
  province: 'New York',
  zip: '11050-4605',
  country: 'United States',
  countryCode: 'US',
  phone: '123123123',
};

test('the design lines: name · street · "CITY Province" · ZIP · country · phone', () => {
  assert.deepEqual(addressLines(HARBOR, 'en'), [
    'Hyein Kim',
    '25 HARBOR PARK DR',
    'PORT WASHINGTON New York',
    '11050-4605',
    'United States',
    '123123123',
  ]);
});

test('a second street line shows; missing parts leave no blank line', () => {
  assert.deepEqual(addressLines({ ...HARBOR, address2: 'Suite 200', phone: null, province: ' ' }, 'en'), [
    'Hyein Kim',
    '25 HARBOR PARK DR',
    'Suite 200',
    'PORT WASHINGTON',
    '11050-4605',
    'United States',
  ]);
  assert.deepEqual(addressLines({ ...HARBOR, name: null, address1: null, city: null, province: null, zip: null, country: null, countryCode: null, phone: null }, 'en'), []);
});

test('the country is named in the widget language', () => {
  const names = Object.fromEntries(['en', 'es', 'ko', 'vi', 'ja', 'zh'].map((l) => [l, countryName(HARBOR, l)]));
  assert.equal(names.en, 'United States');
  assert.equal(names.ko, '미국');
  assert.equal(names.vi, 'Hoa Kỳ');
  assert.equal(names.es, 'Estados Unidos');
  assert.equal(names.zh, '美国');
  assert.ok(names.ja && names.ja !== 'US');
});

test("without a usable code the store's wording stands", () => {
  assert.equal(countryName({ country: 'South Korea', countryCode: null }, 'ko'), 'South Korea');
  assert.equal(countryName({ country: 'Somewhere', countryCode: 'XX9' }, 'en'), 'Somewhere');
  assert.equal(countryName({ country: null, countryCode: null }, 'en'), null);
});

test('order number: "IVY-39891" as is, a bare Shopify number gets "#"', () => {
  assert.equal(displayOrderNumber('IVY-39891'), 'IVY-39891');
  assert.equal(displayOrderNumber('1002'), '#1002');
});
