import type { Page, Route, Request } from '@playwright/test';
import {
  CUSTOMER,
  notifications as seedNotifications,
  orderDetail,
  orderList,
  reviewItems,
  scenarioConfig,
  tracking,
  PRODUCT_CATEGORIES,
} from './ivy-data';

/**
 * Design-test API layer (ivy-docs/ARCHITECTURE.md §8, layer 1).
 *
 * - `POST /session/ensure` goes to the REAL API and is then patched, so the widget keeps the
 *   tenant's real copy/theme while the test controls identity, tabs and consent.
 * - Customer-bound endpoints (notifications, orders, affiliate, inquiries, CSAT…) are served
 *   from an in-memory fake seeded with Figma data. Everything else passes through to the API.
 * - Every mocked call is recorded in `calls` so tests can assert what the widget sent.
 */
export interface MockOptions {
  /** Patch `widgetTabs` to the 2-tab design. Set false to test the tenant's real config (T01). */
  patchTabs?: boolean;
  /** Pretend the shopper is identified via the Shopify App Proxy. */
  authenticated?: boolean;
  /** Pretend consent was already given (hides the consent banner). */
  consent?: 'granted' | 'pending';
  /** Include the My Orders / Affiliate scenario buttons besides the 7 design quick replies. */
  scenarioFlows?: boolean;
  /** Serve the IVY quick-reply config instead of the tenant's real one. */
  mockScenario?: boolean;
  /** Start with an empty notification feed. */
  emptyFeed?: boolean;
  /** Make one endpoint fail (method + path prefix), e.g. { 'POST /reviews': 500 }. */
  failures?: Record<string, number>;
}

export interface RecordedCall {
  method: string;
  path: string;
  query: URLSearchParams;
  body: any;
}

export interface IvyMocks {
  calls: RecordedCall[];
  callsTo(method: string, path: string | RegExp): RecordedCall[];
  state: { notifications: any[] };
}

const ok = (data: unknown) => ({ success: true, data, timestamp: new Date().toISOString() });
const page1 = (items: unknown[], size = 20) => ({
  success: true,
  data: items,
  pagination: {
    page: 1, size, totalCount: items.length, totalPages: Math.max(1, Math.ceil(items.length / size)),
    hasNext: false, hasPrev: false,
  },
  timestamp: new Date().toISOString(),
});
const fail = (status: number) => ({
  success: false, data: null, error: { code: status >= 500 ? 'E9999' : 'E1000', message: 'Mocked failure' },
  timestamp: new Date().toISOString(),
});

export async function installIvyMocks(page: Page, opts: MockOptions = {}): Promise<IvyMocks> {
  const o: Required<MockOptions> = {
    patchTabs: true,
    authenticated: true,
    consent: 'granted',
    scenarioFlows: false,
    mockScenario: true,
    emptyFeed: false,
    failures: {},
    ...opts,
  };
  const state = { notifications: o.emptyFeed ? [] : seedNotifications() };
  const calls: RecordedCall[] = [];

  const record = (req: Request, path: string, url: URL) => {
    let body: any = null;
    try { body = req.postDataJSON(); } catch { body = req.postData(); }
    calls.push({ method: req.method(), path, query: url.searchParams, body });
  };

  const handle = async (route: Route) => {
    const req = route.request();
    const url = new URL(req.url());
    const path = url.pathname.replace(/^.*\/api\/v1/, '');
    const method = req.method();
    const key = `${method} ${path}`;

    const failure = Object.entries(o.failures).find(([k]) => key.startsWith(k));
    if (failure) {
      record(req, path, url);
      return route.fulfill({ status: failure[1], json: fail(failure[1]) });
    }

    // ── Session: real call, patched answer ─────────────────────────────────────
    if (method === 'POST' && path === '/session/ensure') {
      const res = await route.fetch();
      const json = await res.json();
      if (json?.data) {
        if (o.authenticated) {
          json.data.authenticated = true;
          json.data.customerName = CUSTOMER.fullName;
        }
        if (o.patchTabs) json.data.widgetTabs = ['notifications', 'chat'];
        if (o.consent === 'granted') {
          json.data.consentState = 'granted';
          json.data.consentAt = json.data.consentAt ?? new Date(Date.now() - 86_400_000).toISOString();
          json.data.noticeOutdated = false;
        }
      }
      return route.fulfill({ response: res, json });
    }

    if (o.mockScenario && method === 'GET' && path === '/ai-config/scenario') {
      record(req, path, url);
      return route.fulfill({ json: ok(scenarioConfig({ withFlows: o.scenarioFlows })) });
    }

    if (!o.authenticated) return route.fallback();

    // ── Notifications ──────────────────────────────────────────────────────────
    if (method === 'GET' && path === '/notifications/unread-count') {
      return route.fulfill({ json: ok({ count: state.notifications.filter((n) => !n.read).length }) });
    }
    if (method === 'GET' && path === '/notifications') {
      record(req, path, url);
      const category = url.searchParams.get('category') ?? 'all';
      const items = category === 'all' ? state.notifications : state.notifications.filter((n) => n.category === category);
      return route.fulfill({ json: page1(items) });
    }
    if (method === 'DELETE' && path === '/notifications') {
      record(req, path, url);
      const body = req.postDataJSON() ?? {};
      const before = state.notifications.length;
      state.notifications = body.all ? [] : state.notifications.filter((n) => !(body.ids ?? []).map(String).includes(n.id));
      return route.fulfill({ json: ok({ deleted: before - state.notifications.length }) });
    }
    const readMatch = path.match(/^\/notifications\/(\w+)\/read$/);
    if (method === 'POST' && readMatch) {
      record(req, path, url);
      const n = state.notifications.find((x) => x.id === readMatch[1]);
      if (n) { n.read = true; n.readAt = new Date().toISOString(); }
      return route.fulfill({ json: ok(n ?? null) });
    }
    if (path === '/notifications/marketing-opt-out') {
      record(req, path, url);
      return route.fulfill({ json: ok({ optOut: false }) });
    }
    if (path === '/notifications/prefs') {
      return route.fulfill({ json: ok([]) });
    }

    // ── Orders / delivery / reviews ────────────────────────────────────────────
    if (method === 'GET' && path === '/orders') {
      record(req, path, url);
      return route.fulfill({ json: page1(orderList()) });
    }
    if (method === 'GET' && path === '/orders/review-items') {
      return route.fulfill({ json: ok(reviewItems()) });
    }
    const trackMatch = path.match(/^\/orders\/(\w+)\/tracking$/);
    if (method === 'GET' && trackMatch) {
      return route.fulfill({ json: ok(tracking(trackMatch[1])) });
    }
    const orderMatch = path.match(/^\/orders\/(\w+)$/);
    if (method === 'GET' && orderMatch) {
      record(req, path, url);
      return route.fulfill({ json: ok(orderDetail(orderMatch[1])) });
    }
    if (method === 'POST' && path === '/reviews') {
      record(req, path, url);
      return route.fulfill({ status: 201, json: ok({ id: '1' }) });
    }

    // ── Products (Product Help, T10) ───────────────────────────────────────────
    if (method === 'GET' && path === '/products/categories') {
      return route.fulfill({ json: ok(PRODUCT_CATEGORIES) });
    }
    if (method === 'GET' && (path === '/products' || path === '/products/recommendations')) {
      record(req, path, url);
      const items = [
        { handle: 'gel-polish-set', title: 'Gel Polish Starter Set', vendor: 'KISS', price: 24.99, currency: 'USD', imageUrl: null, productUrl: 'https://ivyusa.com/products/gel-polish-set', category: 'Nails' },
        { handle: 'impress-press-on', title: 'imPRESS Press-on Manicure', vendor: 'KISS', price: 9.99, currency: 'USD', imageUrl: null, productUrl: 'https://ivyusa.com/products/impress-press-on', category: 'Nails' },
      ];
      return route.fulfill({ json: path === '/products' ? page1(items) : ok(items) });
    }
    if (method === 'POST' && path === '/restock/subscribe') {
      record(req, path, url);
      return route.fulfill({ status: 201, json: ok({ subscribed: true }) });
    }

    // ── Affiliate / contact / CSAT ─────────────────────────────────────────────
    if (method === 'GET' && path === '/affiliate/status') {
      return route.fulfill({ json: ok({ status: 'none', linkCode: null, commissionRate: 10 }) });
    }
    if (method === 'POST' && path === '/affiliate/apply') {
      record(req, path, url);
      return route.fulfill({ status: 201, json: ok({ status: 'pending', linkCode: null, commissionRate: 10 }) });
    }
    if (method === 'POST' && path === '/inquiries') {
      record(req, path, url);
      return route.fulfill({ status: 201, json: ok({ id: '9001', status: 'open' }) });
    }
    if (method === 'POST' && path === '/chat/csat') {
      record(req, path, url);
      return route.fulfill({ status: 201, json: ok({ ok: true }) });
    }
    if (method === 'POST' && path === '/chat/end') {
      record(req, path, url);
      return route.fulfill({ status: 201, json: ok({ ended: true, canRate: true }) });
    }

    // ── Privacy (identified shopper) ───────────────────────────────────────────
    if (method === 'GET' && path === '/privacy/opt-out/status') {
      return route.fulfill({ json: ok({ optOut: false }) });
    }

    return route.fallback();
  };

  // A test can finish while a request is still in flight — the widget fires
  // `session/ensure` twice in dev (StrictMode, ivy-docs BUG-003). Answering it
  // after the context is torn down throws "Response has been disposed", which
  // Playwright pins on a test that had already PASSED (3 such flakes on
  // 2026-11-10). Teardown errors are ignored; every other error still fails.
  const TEARDOWN = /has been disposed|has been closed|Target closed|Test ended|Failed to find context/i;
  await page.route('**/api/v1/**', async (route: Route) => {
    try {
      await handle(route);
    } catch (err) {
      if (TEARDOWN.test(String((err as Error)?.message ?? err))) return;
      throw err;
    }
  });

  return {
    calls,
    state,
    callsTo: (method, p) =>
      calls.filter((c) => c.method === method && (typeof p === 'string' ? c.path === p : p.test(c.path))),
  };
}
