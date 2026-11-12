/**
 * Widget toasts (ivy-docs T07 D3): success closes itself, an error stays until
 * the shopper closes it, and the queue never piles up.
 *
 * Run: node --test apps/widget/test/*.mjs
 */
import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import { buildSync } from 'esbuild';
import { fileURLToPath } from 'node:url';

// zustand/vanilla has no React dependency, so the store bundles on its own.
const { outputFiles } = buildSync({
  entryPoints: [fileURLToPath(new URL('../src/lib/toast.ts', import.meta.url))],
  bundle: true,
  format: 'esm',
  write: false,
  platform: 'neutral',
});
mock.timers.enable({ apis: ['setTimeout'] });
const { toastStore, showToast, SUCCESS_TOAST_MS, MAX_TOASTS } = await import(
  `data:text/javascript,${encodeURIComponent(outputFiles[0].text)}`
);
const toasts = () => toastStore.getState().toasts;

test.beforeEach(() => toastStore.getState().clear());

test('a success toast closes itself after SUCCESS_TOAST_MS', () => {
  showToast({ tone: 'success', message: '2 notifications deleted' });
  assert.equal(toasts().length, 1);
  mock.timers.tick(SUCCESS_TOAST_MS - 1);
  assert.equal(toasts().length, 1);
  mock.timers.tick(1);
  assert.equal(toasts().length, 0);
});

test('an error toast stays until dismissed', () => {
  const id = showToast({ tone: 'error', message: "Couldn't delete notifications." });
  mock.timers.tick(SUCCESS_TOAST_MS * 10);
  assert.equal(toasts().length, 1);
  toastStore.getState().dismiss(id);
  assert.equal(toasts().length, 0);
});

test('the same message twice shows once; the queue keeps the newest MAX_TOASTS', () => {
  showToast({ tone: 'error', message: 'again' });
  showToast({ tone: 'error', message: 'again' });
  assert.equal(toasts().length, 1);
  for (let i = 0; i < MAX_TOASTS + 2; i++) showToast({ tone: 'error', message: `m${i}` });
  assert.equal(toasts().length, MAX_TOASTS);
  assert.equal(toasts().at(-1).message, `m${MAX_TOASTS + 1}`);
});
