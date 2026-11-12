import { test as base, expect, type Locator, type Page } from '@playwright/test';
import { installIvyMocks, type IvyMocks, type MockOptions } from './mock-api';

export type Lang = 'en' | 'es' | 'ko' | 'vi' | 'ja' | 'zh';

/**
 * Page Object for the TalkTalk widget. Selectors follow the contract in ivy-docs/SPEC.md §9:
 * roles + English accessible names first, data-testid only for structural pieces.
 */
export class Widget {
  constructor(readonly page: Page) {}

  // ── Shell ────────────────────────────────────────────────────────────────────
  /** Language-agnostic: the accessible name is localized (checked separately in TC-15-*). */
  get launcher(): Locator { return this.page.locator('button.st-launcher'); }
  get panel(): Locator { return this.page.locator('[role="dialog"].st-panel'); }
  get headerTitle(): Locator { return this.panel.locator('.st-header-title').first(); }
  get languageButton(): Locator { return this.panel.getByRole('button', { name: 'Language' }); }
  get settingsButton(): Locator { return this.panel.getByRole('button', { name: 'Settings' }); }
  get closeButton(): Locator { return this.panel.getByRole('button', { name: 'Close' }); }
  get tabs(): Locator { return this.panel.getByRole('tab'); }
  tab(name: 'Notifications' | 'Chat' | 'Orders' | RegExp): Locator {
    return this.panel.getByRole('tab', { name: typeof name === 'string' ? new RegExp(`^${name}`) : name });
  }
  tabBadge(tab: Locator, count: number): Locator { return tab.getByLabel(`${count} unread`); }

  // ── Notifications ────────────────────────────────────────────────────────────
  chip(name: string): Locator { return this.panel.getByRole('button', { name, exact: true }); }
  get notifItems(): Locator { return this.panel.getByTestId('notif-item'); }
  get notifGroups(): Locator { return this.panel.getByTestId('notif-group'); }
  get deliveryCards(): Locator { return this.panel.getByTestId('delivery-card'); }
  get promoItems(): Locator { return this.panel.getByTestId('promo-item'); }
  statusPill(scope: Locator = this.panel): Locator { return scope.getByTestId('status-pill'); }

  // ── Chat ─────────────────────────────────────────────────────────────────────
  get quickReplies(): Locator { return this.panel.getByTestId('quick-replies'); }
  get composer(): Locator { return this.panel.getByRole('textbox').last(); }
  get sendButton(): Locator { return this.panel.getByRole('button', { name: 'Send', exact: true }); }
  /** Latest scenario/quick-reply button with that label (menus repeat after "Start over"). */
  scenarioButton(name: RegExp | string): Locator { return this.panel.getByRole('button', { name }).last(); }

  /** Opens the demo storefront that hosts the widget (local) or the standalone widget (prod). */
  async goto(opts: { lang?: Lang; params?: Record<string, string> } = {}) {
    const lang = opts.lang ?? 'en';
    // Only seed the language when none is stored, so a reload keeps the shopper's choice.
    await this.page.addInitScript((l) => {
      try { if (!localStorage.getItem('ivy_lang')) localStorage.setItem('ivy_lang', l); } catch {}
    }, lang);
    const qs = new URLSearchParams({ shop: 'ivyusa.myshopify.com', ...(opts.params ?? {}) });
    await this.page.goto(`?${qs.toString()}`);
    await expect(this.launcher).toBeVisible();
  }

  async open() {
    await this.launcher.click();
    await expect(this.panel).toBeVisible();
  }

  /**
   * Accept the banner a `consent: 'pending'` run shows, so the SERVER session is
   * consented — tests that run real scripts need that. Waits for the session
   * bootstrap to finish first: while the widget loads, a slower
   * `/session/ensure` can still swap the token, and consent given to the token
   * it drops is lost (ivy-docs BUG-003, dev server only). Waits for the banner instead of
   * peeking, unlike `acceptConsentIfShown`.
   */
  async acceptConsent() {
    await this.page.waitForLoadState('networkidle');
    const accept = this.panel.getByRole('button', { name: 'Accept', exact: true });
    await accept.click();
    await expect(accept).toBeHidden();
  }

  /** Real-API runs start with a consent banner; design runs patch consent to granted. */
  async acceptConsentIfShown() {
    const accept = this.panel.getByRole('button', { name: 'Accept', exact: true });
    if (await accept.isVisible().catch(() => false)) {
      await accept.click();
      await expect(accept).toBeHidden();
    }
  }

  async openNotifications() {
    await this.tab('Notifications').click();
    await expect(this.tab('Notifications')).toHaveAttribute('aria-selected', 'true');
  }

  async openChat() {
    await this.tab('Chat').click();
    await expect(this.tab('Chat')).toHaveAttribute('aria-selected', 'true');
  }

  async chooseLanguage(endonym: 'English' | 'Español' | '한국어' | 'Tiếng Việt' | '日本語' | '简体中文') {
    await this.languageButton.click();
    await this.panel.getByRole('option', { name: new RegExp('^' + endonym) }).click();
  }
}

/** Collects console errors so tests can assert a clean console (NFR-04). */
export function watchConsole(page: Page) {
  const errors: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(e.message));
  return errors;
}

type Fixtures = {
  widget: Widget;
  /** Options for the design-test API layer; override per describe with test.use({ mockOptions }). */
  mockOptions: MockOptions | false;
  mocks: IvyMocks | null;
};

export const test = base.extend<Fixtures>({
  mockOptions: [{}, { option: true }],
  mocks: async ({ page, mockOptions }, use) => {
    await use(mockOptions === false ? null : await installIvyMocks(page, mockOptions));
  },
  widget: async ({ page, mocks: _mocks }, use) => {
    await use(new Widget(page));
  },
});

export { expect };
