import type { Page } from '@playwright/test';
import { test, expect } from '../fixtures/widget';

/**
 * BUG-044 — a staff reply has to reach the chat the shopper sees.
 *
 * The owner answered a signed-in shopper from the console and the bell lit up
 * on the website, but the chat showed another conversation: the shopper had
 * several chat sessions, and the widget only ever shows its own. Now the server
 * names the chat staff last replied in as current, the widget asks again when
 * the chat is opened (or a staff reply arrives), and a thread that changes
 * under it is read whole instead of being grafted onto the old one.
 *
 * `/chat/conversation` and identify are mocked here: what is under test is what
 * the widget does when the answer changes, not how the server picks it.
 */
const API = process.env.E2E_RESOLVED_API_URL ?? 'http://localhost:3000/api/v1';
const ok = (data: unknown) => ({ success: true, data, timestamp: new Date().toISOString() });

type Msg = { id: string; senderType: string; body: string };
const OLD: Msg[] = [
  { id: '9001', senderType: 'user', body: 'Old question about a refund' },
  { id: '9002', senderType: 'ai', body: 'Old answer about refunds' },
];
const NEW: Msg[] = [
  { id: '9101', senderType: 'user', body: 'Where is my order 1042?' },
  { id: '9102', senderType: 'agent', body: 'Your order 1042 ships today.' },
];

/** The conversation endpoint's answer, honouring the widget's ?after_id= delta cursor. */
function conversation(id: string, status: string, msgs: Msg[], afterId: string | null) {
  const rows = msgs
    .filter((m) => afterId == null || Number(m.id) > Number(afterId))
    .map((m, i) => ({
      id: m.id,
      senderType: m.senderType,
      senderId: null,
      senderName: m.senderType === 'agent' ? 'Ivyusa Support' : null,
      body: m.body,
      createdAt: new Date(Date.now() - (10 - i) * 60_000).toISOString(),
      attachments: [],
    }));
  return ok({ conversationId: id, status, csatRating: null, canRate: false, messages: rows });
}

test.describe('BUG-044 · the chat follows staff replies', () => {
  test.use({ mockOptions: { authenticated: true, consent: 'granted' } });

  test('TC-08-09 another conversation on the server replaces the thread instead of being grafted onto it @T08', async ({ widget, page }) => {
    const state = { switched: false };
    await page.route('**/api/v1/chat/conversation**', (route) => {
      const after = new URL(route.request().url()).searchParams.get('after_id');
      return route.fulfill({
        json: state.switched ? conversation('7702', 'agent', NEW, after) : conversation('7701', 'ai_active', OLD, after),
      });
    });
    await widget.goto();
    await widget.open();
    await widget.openChat();
    const p = widget.panel;
    await expect(p.getByText('Old question about a refund')).toBeVisible();

    // Staff replied in another conversation of this chat session; the next poll
    // (a delta against the old thread's cursor) comes back with it.
    state.switched = true;
    await expect(p.getByText('Your order 1042 ships today.')).toBeVisible({ timeout: 15_000 });
    await expect(p.getByText('Where is my order 1042?')).toBeVisible();
    await expect(p.getByText('Old question about a refund')).toHaveCount(0);
  });

  test("TC-08-10 staff replied in the shopper's other chat: opening Chat goes there @T08", async ({ page, mocks: _mocks, request }) => {
    // A second real session stands for the shopper's other chat (another day or device).
    const ensured = await request.post(`${API}/session/ensure`, {
      data: { locale: 'en', shop_domain: 'ivyusa.myshopify.com' },
    });
    const other = ((await ensured.json()) as { data: { sessionToken: string } }).data.sessionToken;
    expect(other).toBeTruthy();

    const state = { moveTo: null as string | null };
    const identifyCalls: string[] = [];
    await page.route('**/api/v1/public/embed/identify', (route) => {
      const body = route.request().postDataJSON() as { session_token: string };
      identifyCalls.push(body.session_token);
      return route.fulfill({
        json: ok({
          // The server names the chat staff last replied in (BUG-044); until then, this one.
          sessionToken: state.moveTo ?? body.session_token,
          authenticated: true,
          customerName: 'Mia',
          consentState: 'granted',
          consentAt: new Date(Date.now() - 86_400_000).toISOString(),
          noticeOutdated: false,
          threadAvailable: false,
        }),
      });
    });
    await page.route('**/api/v1/chat/conversation**', (route) => {
      const token = route.request().headers()['x-session-token'];
      const after = new URL(route.request().url()).searchParams.get('after_id');
      return route.fulfill({
        json: token === other ? conversation('7802', 'agent', NEW, after) : conversation('7801', 'ai_active', OLD, after),
      });
    });

    const panel = await openSignedInStorefront(page);
    await panel.getByRole('tab', { name: /^Chat/ }).click();
    await expect(panel.getByText('Old question about a refund')).toBeVisible();

    // Staff answered in the shopper's other chat.
    state.moveTo = other;
    await panel.getByRole('tab', { name: /^Notifications/ }).click();
    await panel.getByRole('tab', { name: /^Chat/ }).click();

    await expect(panel.getByText('Your order 1042 ships today.')).toBeVisible({ timeout: 15_000 });
    await expect(panel.getByText('Where is my order 1042?')).toBeVisible();
    await expect(panel.getByText('Old question about a refund')).toHaveCount(0);
    // Once on page load, again when the chat was opened.
    expect(identifyCalls.length).toBeGreaterThanOrEqual(2);
  });
});

/** A storefront like ivyusa.com with the theme's signed identify, opened from the header bell. */
async function openSignedInStorefront(page: Page) {
  const origin = new URL(process.env.E2E_RESOLVED_WIDGET_URL ?? 'http://localhost:5174/').origin;
  const hostUrl = `${origin}/__ivy-identify-storefront.html`;
  await page.route(hostUrl, (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>ivyusa.com (identify test host)</title></head>
<body><header style="height:72px;display:flex;align-items:center;justify-content:flex-end;padding:0 16px">
<button id="st-bell" type="button" aria-label="Notifications" style="width:24px;height:24px">🔔</button></header>
<main style="height:1200px"></main>
<script>
  window.SharpTalk = window.SharpTalk || { q: [] };
  window.SharpTalk.q.push(['identify', { userId: 'shopify:42:1795000000', hash: 'signed-by-the-theme', name: 'Mia' }]);
  window.SHARPTALK_WIDGET_CONFIG = { shop: 'ivyusa.myshopify.com', locale: 'en', widgetUrl: '${origin}', trigger: '#st-bell' };
</script>
<script src="${origin}/embed.js"></script></body></html>`,
    }),
  );
  await page.addInitScript(() => {
    try { localStorage.setItem('ivy_lang', 'en'); } catch { /* storage blocked */ }
  });
  await page.goto(hostUrl);
  const panel = page.frameLocator('#ivy-talktalk-frame').locator('[role="dialog"].st-panel');
  await page.locator('#st-bell').click();
  await expect(panel).toBeVisible();
  return panel;
}
