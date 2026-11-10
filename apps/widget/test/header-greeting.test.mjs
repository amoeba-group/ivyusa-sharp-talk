/**
 * Signed-in header greeting (PLN-261110-IVY-T01 D2): `{firstName}` is opt-in
 * tenant copy; `{name}` and the built-in default keep the full name.
 *
 * Run: node --test apps/widget/test/
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSync } from 'esbuild';
import { fileURLToPath } from 'node:url';

const { outputFiles } = buildSync({
  entryPoints: [fileURLToPath(new URL('../src/lib/copy.ts', import.meta.url))],
  bundle: true,
  format: 'esm',
  write: false,
  platform: 'neutral',
});
const { firstNameOf, greetingFor } = await import(
  `data:text/javascript,${encodeURIComponent(outputFiles[0].text)}`
);

test('first name is the first word of a Shopify "First Last" name', () => {
  assert.equal(firstNameOf('Kiho Lee'), 'Kiho');
  assert.equal(firstNameOf('  Kiho   Lee  '), 'Kiho');
  assert.equal(firstNameOf('Kiho'), 'Kiho');
});

test('a name without spaces (CJK) is kept whole; empty stays empty', () => {
  assert.equal(firstNameOf('이기호'), '이기호');
  assert.equal(firstNameOf('山田太郎'), '山田太郎');
  assert.equal(firstNameOf(''), '');
  assert.equal(firstNameOf('   '), '');
  assert.equal(firstNameOf(null), '');
  assert.equal(firstNameOf(undefined), '');
});

test('{firstName} greets by first name', () => {
  assert.equal(greetingFor('Hi, {firstName}', 'Kiho Lee'), 'Hi, Kiho');
  assert.equal(greetingFor('{firstName}님', 'Kiho Lee'), 'Kiho님');
  assert.equal(greetingFor('{firstName}', 'Kiho Lee'), 'Kiho');
});

test('{name} keeps the full name — other tenants are unaffected', () => {
  assert.equal(greetingFor('Hi, {name}', 'Kiho Lee'), 'Hi, Kiho Lee');
  assert.equal(greetingFor('Chào {name}', 'Nguyễn Văn A'), 'Chào Nguyễn Văn A');
  assert.equal(greetingFor('Welcome back', 'Kiho Lee'), 'Welcome back');
});

test('both placeholders can be combined, and repeat', () => {
  assert.equal(greetingFor('{firstName} ({name})', 'Kiho Lee'), 'Kiho (Kiho Lee)');
  assert.equal(greetingFor('{firstName}, {firstName}!', 'Kiho Lee'), 'Kiho, Kiho!');
});
