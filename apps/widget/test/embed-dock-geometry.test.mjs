/**
 * The docked frame has to fit the window it hangs in (FIX-260920).
 *
 * Trigger mode starts the frame `offsetTop` down the page, but the open box was
 * still `min(<frame>px, 100vh)` — so a 68px offset pushed the bottom 68px past
 * the window, the panel looked unrelated to the window height, and the composer
 * went off-screen. The fix reserves the offset (plus the bit of breathing room
 * the panel's own gutter does not already provide) and leaves floating alone.
 *
 * Run: node --test apps/widget/test/
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const SRC = readFileSync(new URL('../public/embed.js', import.meta.url), 'utf8');
const WIDGET_ORIGIN = 'https://host.example';

/**
 * Boot the real loader against a stub page and hand back the iframe's inline
 * style plus a way to post the widget's own messages at it.
 */
function mount(opts = {}) {
  const { frame, send } = mountPage(opts);
  return { frame, send };
}

/** As `mount`, with the page pieces the header-following dock reads (PLN-261118). */
function mountPage({
  config = { shop: 's.myshopify.com', trigger: '#st-bell' },
  hasTrigger = true,
  innerWidth = 1280,
  innerHeight,
  dvh = false,
  opener = { tagName: 'BUTTON' },
  extra = {},
  raf,
} = {}) {
  const mounted = [];
  const handlers = {};
  const doc = {
    referrer: '',
    readyState: 'complete',
    documentElement: { lang: 'en' },
    body: { appendChild: (n) => mounted.push(n) },
    getElementById: () => null,
    // The storefront's opener. Without it the loader falls back to the floating
    // launcher on purpose (FIX-260916), which is a different geometry entirely.
    querySelector: (sel) => (hasTrigger && sel === '#st-bell' ? opener : extra[sel] ?? null),
    querySelectorAll: () => [],
    addEventListener() {},
    createElement: () => ({ style: {}, setAttribute() {} }),
    getElementsByTagName: () => [],
    currentScript: { src: `${WIDGET_ORIGIN}/widget/embed.js` },
  };
  const win = {
    name: '',
    opener: null,
    innerWidth,
    ...(innerHeight ? { innerHeight } : {}),
    ...(raf ? { requestAnimationFrame: raf } : {}),
    // `100dvh` support, as `CSS.supports` reports it (T15 D1).
    ...(dvh ? { CSS: { supports: (prop, value) => prop === 'height' && value === '100dvh' } } : {}),
    SHARPTALK_WIDGET_CONFIG: config,
    location: {
      hostname: 'shop.example',
      pathname: '/',
      search: '',
      href: 'https://shop.example/',
      origin: 'https://shop.example',
    },
    addEventListener(type, fn) {
      (handlers[type] = handlers[type] || []).push(fn);
    },
    console: { error() {}, info() {}, warn() {} },
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
  };
  const ctx = {
    window: win,
    document: doc,
    sessionStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    history: { replaceState() {} },
    fetch: () => Promise.resolve({ ok: false, json: () => Promise.resolve(null) }),
    URL,
    URLSearchParams,
    setTimeout,
    clearTimeout,
    setInterval: () => 0,
    clearInterval() {},
    console: win.console,
  };
  ctx.window.window = ctx.window;
  ctx.window.document = doc;
  vm.createContext(ctx);
  vm.runInContext(SRC, ctx);

  const frame = mounted.find((n) => n && typeof n.src === 'string' && n.src.includes('embed=1'));
  assert.ok(frame, 'no iframe mounted');
  const send = (data, origin = WIDGET_ORIGIN) => {
    for (const fn of handlers.message || []) fn({ data, origin, source: null });
  };
  const fire = (type) => {
    for (const fn of handlers[type] || []) fn({});
  };
  return { frame, send, fire };
}

/** The widget reports its geometry, then the panel opens — the usual order. */
function openDocked({ offsetTop = 68, frameBox = { w: 420, h: 800 } } = {}) {
  const { frame, send } = mount();
  send({ type: 'ivy:launcher', position: 'right', size: 96, mode: 'trigger', offsetTop, trigger: '#st-bell', frame: frameBox });
  send({ type: 'ivy:resize', open: true });
  return { frame, send };
}

test('the docked frame reserves the header offset it starts below', () => {
  const { frame } = openDocked({ offsetTop: 68 });
  assert.equal(frame.style.top, '68px');
  // 68 offset + 5: the panel holds the other 20px of the 25px bottom gap itself.
  assert.equal(frame.style.height, 'min(800px, calc(100vh - 73px))');
  assert.equal(frame.style.width, 'min(420px, 100vw)');
});

test('a taller offset reserves more, not less', () => {
  const { frame } = openDocked({ offsetTop: 140 });
  assert.equal(frame.style.height, 'min(800px, calc(100vh - 145px))');
});

test('floating keeps the full window height', () => {
  const { frame, send } = mount({ config: { shop: 's.myshopify.com' }, hasTrigger: false });
  send({
    type: 'ivy:launcher',
    position: 'right',
    size: 96,
    mode: 'floating',
    offsetTop: 0,
    trigger: null,
    frame: { w: 444, h: 680 },
  });
  send({ type: 'ivy:resize', open: true });
  assert.equal(frame.style.height, 'min(680px, 100vh)');
  assert.equal(frame.style.top, 'auto');
});

test('an open panel follows a later theme change instead of collapsing', () => {
  // The old guard asked "is the inline width still the OPEN string?" to decide
  // whether the panel was closed. Recomputing OPEN made that question answer
  // "no" for an OPEN panel, which shut it mid-conversation.
  const { frame, send } = openDocked({ offsetTop: 68 });
  send({
    type: 'ivy:launcher',
    position: 'right',
    size: 96,
    mode: 'trigger',
    offsetTop: 120,
    trigger: '#st-bell',
    frame: { w: 420, h: 800 },
  });
  assert.equal(frame.style.height, 'min(800px, calc(100vh - 125px))');
  assert.notEqual(frame.style.width, '0px');
});

test('the card geometry is not hidden behind a viewport media query', () => {
  // The root cause: `.ivy-panel-desktop` (panel size + corner radius) sat inside
  // `@media (min-width: 640px)`, and inside the loader's iframe the viewport IS
  // the frame — 420px for a 380px panel, 520px at the largest panel a tenant can
  // set. The query never matched on a storefront, so every embed rendered the
  // mobile sheet: full bleed, square corners, configured size ignored.
  const css = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8');
  const rule = css.indexOf('.ivy-panel-desktop');
  assert.ok(rule > 0, '.ivy-panel-desktop is gone — did the class get renamed?');
  const opensBefore = (css.slice(0, rule).match(/@media[^{]*\{/g) || []).length;
  const closesBefore = (css.slice(0, rule).match(/\}/g) || []).length;
  assert.ok(
    opensBefore <= closesBefore,
    '.ivy-panel-desktop is inside a media query again — the page width the widget can see is its own iframe, not the store',
  );
});

// ivy-docs T15 D1 (SPEC NFR-03): on a phone the open panel is the whole screen,
// not a 680px sheet with the shop still showing above it.
const FLOATING = { shop: 's.myshopify.com' };

test('a phone opens the floating panel full screen, at the height the shopper can see', () => {
  const { frame, send } = mount({ config: FLOATING, hasTrigger: false, innerWidth: 390, dvh: true });
  assert.ok(frame.src.includes('&compact=1'), 'the widget is told it is on a phone');
  send({ type: 'ivy:launcher', position: 'right', size: 96, mode: 'floating', frame: { w: 380, h: 680 } });
  send({ type: 'ivy:resize', open: true });
  assert.equal(frame.style.width, '100vw');
  assert.equal(frame.style.height, '100dvh');
});

test('without dvh the phone falls back to 100vh', () => {
  const { frame, send } = mount({ config: FLOATING, hasTrigger: false, innerWidth: 390 });
  send({ type: 'ivy:launcher', position: 'right', size: 96, mode: 'floating', frame: { w: 380, h: 680 } });
  send({ type: 'ivy:resize', open: true });
  assert.equal(frame.style.height, '100vh');
});

test('a phone is full screen on the very first open, before the widget reports its launcher', () => {
  const { frame, send } = mount({ config: FLOATING, hasTrigger: false, innerWidth: 390, dvh: true });
  send({ type: 'ivy:resize', open: true });
  assert.equal(frame.style.width, '100vw');
  assert.equal(frame.style.height, '100dvh');
});

test('docked on a phone, the panel fills the screen under the storefront header', () => {
  const { frame, send } = mount({ innerWidth: 390, dvh: true });
  send({ type: 'ivy:launcher', position: 'right', size: 96, mode: 'trigger', offsetTop: 68, trigger: '#st-bell', frame: { w: 420, h: 800 } });
  send({ type: 'ivy:resize', open: true });
  assert.equal(frame.style.width, '100vw');
  assert.equal(frame.style.height, 'calc(100dvh - 68px)');
});

test('640px and wider is not a phone: the floating box is unchanged', () => {
  const { frame, send } = mount({ config: FLOATING, hasTrigger: false, innerWidth: 640, dvh: true });
  assert.ok(!frame.src.includes('compact=1'));
  send({ type: 'ivy:launcher', position: 'right', size: 96, mode: 'floating', frame: { w: 444, h: 680 } });
  send({ type: 'ivy:resize', open: true });
  assert.equal(frame.style.width, 'min(444px, 100vw)');
  assert.equal(frame.style.height, 'min(680px, 100vh)');
});

/**
 * The docked panel follows the storefront header (PLN-261118 bell).
 *
 * ivyusa.com's header ends at 171px at the top of the page, at 91px once it
 * sticks, at 208px on a tablet, and leaves the window altogether on a phone
 * scrolled down. One fixed offset is right for one of those at best.
 */
function mountWithHeader({ bottom, innerWidth = 1280, innerHeight = 900, config } = {}) {
  const header = { bottom };
  const rafQueue = [];
  const m = mountPage({
    config: config ?? { shop: 's.myshopify.com', trigger: '#st-bell' },
    innerWidth,
    innerHeight,
    opener: { tagName: 'BUTTON', closest: () => ({ getBoundingClientRect: () => ({ bottom: header.bottom }) }) },
    raf: (fn) => rafQueue.push(fn),
  });
  const flush = () => { for (let i = 0; i < 80 && rafQueue.length; i++) rafQueue.shift()(); };
  m.send({ type: 'ivy:launcher', position: 'right', size: 96, mode: 'trigger', offsetTop: 176, trigger: '#st-bell', frame: { w: 420, h: 680 } });
  m.send({ type: 'ivy:resize', open: true });
  flush();
  return { ...m, header, flush, scroll: () => { m.fire('scroll'); flush(); } };
}

test('the docked frame starts 8px under the header that holds the opener, not at the fixed offset', () => {
  const { frame } = mountWithHeader({ bottom: 171 });
  assert.equal(frame.style.top, '179px');
  assert.equal(frame.style.height, 'min(680px, calc(100vh - 184px))');
});

test('it follows the header when the header sticks on scroll', () => {
  const { frame, header, scroll } = mountWithHeader({ bottom: 171 });
  header.bottom = 91;
  scroll();
  assert.equal(frame.style.top, '99px');
  assert.equal(frame.style.height, 'min(680px, calc(100vh - 104px))');
});

test('a taller header (tablet) is not covered', () => {
  const { frame } = mountWithHeader({ bottom: 208, innerWidth: 768, innerHeight: 1024 });
  assert.equal(frame.style.top, '216px');
});

test('a phone sits flush under the header, and takes the whole screen once the header scrolls away', () => {
  const { frame, header, scroll } = mountWithHeader({ bottom: 176, innerWidth: 390, innerHeight: 844 });
  assert.equal(frame.style.top, '176px');
  assert.equal(frame.style.height, 'calc(100vh - 176px)');
  header.bottom = 0;
  scroll();
  assert.equal(frame.style.top, '0px');
  assert.equal(frame.style.height, '100vh');
  header.bottom = 176;
  scroll();
  assert.equal(frame.style.top, '176px');
});

test('too little room under the header (a phone on its side): the panel covers it', () => {
  const { frame } = mountWithHeader({ bottom: 175, innerWidth: 734, innerHeight: 343 });
  assert.equal(frame.style.top, '0px');
  assert.equal(frame.style.height, 'min(680px, 100vh)');
});

test('nothing is measured while the panel is closed', () => {
  const { frame, header, send, scroll } = mountWithHeader({ bottom: 171 });
  send({ type: 'ivy:resize', open: false });
  header.bottom = 91;
  scroll();
  assert.equal(frame.style.top, '179px');
  send({ type: 'ivy:resize', open: true });
  assert.equal(frame.style.top, '99px');
});

test('an explicit anchor selector wins over the opener\'s header', () => {
  const m = mountPage({
    config: { shop: 's.myshopify.com', trigger: '#st-bell', anchor: '#bar' },
    innerHeight: 900,
    opener: { tagName: 'BUTTON', closest: () => ({ getBoundingClientRect: () => ({ bottom: 500 }) }) },
    extra: { '#bar': { getBoundingClientRect: () => ({ bottom: 60 }) } },
    raf: () => 0,
  });
  m.send({ type: 'ivy:launcher', position: 'right', size: 96, mode: 'trigger', offsetTop: 176, trigger: '#st-bell', frame: { w: 420, h: 680 } });
  m.send({ type: 'ivy:resize', open: true });
  assert.equal(m.frame.style.top, '68px');
});

test('no header to measure: the tenant\'s offset still applies', () => {
  const { frame } = openDocked({ offsetTop: 68 });
  assert.equal(frame.style.top, '68px');
});
