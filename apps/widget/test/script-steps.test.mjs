/**
 * Step cards in a scripted reply (ivy-docs T12, SCR-IVY-14).
 *
 * The affiliate answer is tenant-edited text: numbered `1. **Title** — text`
 * lines become the design's step cards, the lines around them stay bubbles.
 *
 * Run: node --test apps/widget/test/*.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSync } from 'esbuild';
import { fileURLToPath } from 'node:url';

const { outputFiles } = buildSync({
  entryPoints: [fileURLToPath(new URL('../src/lib/script-steps.ts', import.meta.url))],
  bundle: true,
  format: 'esm',
  write: false,
  platform: 'neutral',
});
const { splitScriptSteps } = await import(`data:text/javascript,${encodeURIComponent(outputFiles[0].text)}`);

const IVY_EN =
  'Become an IVY Beauty affiliate partner! 💼\n\n' +
  '1. **Submit an application** — Fill out a short form.\n' +
  '2. **Review (1–3 business days)** — Our team will review it and email you.\n' +
  '3. **Start earning** — Share your own link → earn 10% on every sale!\n\n' +
  'If you have any questions, just ask!';

test('the affiliate answer: opening line, three cards, closing line', () => {
  assert.deepEqual(splitScriptSteps(IVY_EN), {
    before: 'Become an IVY Beauty affiliate partner! 💼',
    steps: [
      { title: 'Submit an application', text: 'Fill out a short form.' },
      { title: 'Review (1–3 business days)', text: 'Our team will review it and email you.' },
      { title: 'Start earning', text: 'Share your own link → earn 10% on every sale!' },
    ],
    after: 'If you have any questions, just ask!',
  });
});

test('Korean copy, a range inside the title is not a separator', () => {
  const ko = '제휴 파트너가 되어주세요!\n1. **심사 (1–3 영업일)** — 팀에서 검토 후 이메일로 안내드려요.\n2. **활동 시작 & 수익** — 판매 시 10% 적립!';
  const r = splitScriptSteps(ko);
  assert.equal(r.before, '제휴 파트너가 되어주세요!');
  assert.deepEqual(r.steps[0], { title: '심사 (1–3 영업일)', text: '팀에서 검토 후 이메일로 안내드려요.' });
  assert.equal(r.after, '');
});

test('a tenant who drops the bold: title before a spaced dash, or the whole line', () => {
  const r = splitScriptSteps('1) Apply - fill in the form\n2) Wait 1–3 days');
  assert.deepEqual(r.steps, [
    { title: 'Apply', text: 'fill in the form' },
    { title: 'Wait 1–3 days', text: '' },
  ]);
  assert.equal(r.before, '');
});

test('no list, or a single numbered line → not steps (left to the normal bubble)', () => {
  assert.equal(splitScriptSteps('Returns are accepted within 10 days.'), null);
  assert.equal(splitScriptSteps('Step one:\n1. Do this.\nThen you are done.'), null);
  assert.equal(splitScriptSteps(''), null);
});

test('the first run only: text after it, even another numbered line later, stays in the closing bubble', () => {
  const r = splitScriptSteps('Intro\n1. A\n2. B\nMiddle\n3. C');
  assert.deepEqual(r.steps.map((s) => s.title), ['A', 'B']);
  assert.equal(r.after, 'Middle\n3. C');
});
