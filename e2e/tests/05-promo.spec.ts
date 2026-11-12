import { test, expect } from '../fixtures/widget';

/** T05 — Promo notifications: coupon vs event (SCR-IVY-07, G-09). `kind`/`couponCode` come from the row's campaign (PLN-261112-T05 D2). */
const rgb = (s: string) => (s.match(/\d+(\.\d+)?/g) ?? []).slice(0, 3).map(Number);

test.describe('T05 · Notifications — Promo', () => {
  test.beforeEach(async ({ widget }) => {
    await widget.goto();
    await widget.open();
    await widget.openNotifications();
    await widget.chip('Promo').click();
  });

  test('TC-05-01 lists coupons and events with their own style @T05 @design', async ({ widget }) => {
    const coupon = widget.promoItems.filter({ hasText: 'Your exclusive 10% off coupon has arrived!' });
    const event = widget.promoItems.filter({ hasText: 'Mad Shade' });
    await expect(coupon).toHaveAttribute('data-kind', 'coupon');
    await expect(event).toHaveAttribute('data-kind', 'event');
    await expect(event).toContainText('Buy one Get One 50% OFF today !');
    const weight = await event.getByText('Mad Shade', { exact: true }).evaluate((e) => Number(getComputedStyle(e).fontWeight));
    expect(weight).toBeGreaterThanOrEqual(600);
  });

  test('TC-05-02 coupon icon is deep navy, event icon is magenta @T05 @design', async ({ widget }) => {
    const iconBg = (text: string) =>
      widget.promoItems.filter({ hasText: text }).getByTestId('promo-icon').evaluate((e) => getComputedStyle(e).backgroundColor);
    const [cr, cg, cb] = rgb(await iconBg('Your exclusive 10% off coupon'));
    expect(cb, 'coupon icon is navy').toBeGreaterThan(cr);
    expect(cr + cg + cb, 'coupon icon is dark').toBeLessThan(300);
    const [er, eg, eb] = rgb(await iconBg('Mad Shade'));
    expect(er, 'event icon is magenta/pink').toBeGreaterThan(180);
    expect(eg).toBeLessThan(120);
    expect(eb).toBeGreaterThan(60);
  });

  test('TC-05-03 coupon code is shown and can be copied @T05 @design', async ({ page, context, widget }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    const item = widget.promoItems.filter({ hasText: 'BACK TO SCHOOL' });
    await expect(item.getByTestId('coupon-code')).toHaveText('SCHOOL20');
    await item.getByRole('button', { name: /Copy/ }).click();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('SCHOOL20');
    await expect(widget.page.getByRole('status')).toHaveText('Code copied');
  });

  test('TC-05-04 tapping an event with a link opens it @T05 @design', async ({ page, widget }) => {
    // Stub the storefront page and wait for the new tab to navigate before
    // reading its URL — read at the `popup` event it is still "" (BUG-017).
    await page.context().route('https://ivyusa.com/**', (route) =>
      route.fulfill({ contentType: 'text/html', body: '<title>IVY (stub)</title>' }),
    );
    const popup = page.waitForEvent('popup');
    await widget.promoItems.filter({ hasText: 'Mad Shade' }).click();
    const tab = await popup;
    await tab.waitForURL(/ivyusa\.com\/collections\/mad-shade/, { waitUntil: 'commit' });
    expect(tab.url()).toContain('ivyusa.com/collections/mad-shade');
  });
});

test.describe('T05 · Promo — edge cases', () => {
  const openPromo = async (widget: import('../fixtures/widget').Widget) => {
    await widget.goto();
    await widget.open();
    await widget.openNotifications();
    await widget.chip('Promo').click();
  };

  test('TC-05-05 promos sent before T05 (no kind) keep the link guess, in the design colours @T05', async ({ widget, mocks }) => {
    for (const n of mocks!.state.notifications) {
      delete n.kind;
      delete n.couponCode;
    }
    await openPromo(widget);
    // With a link → event (magenta); without → coupon (navy), and no code to copy.
    await expect(widget.promoItems.filter({ hasText: 'Mad Shade' })).toHaveAttribute('data-kind', 'event');
    await expect(widget.promoItems.filter({ hasText: 'Your exclusive 10% off' })).toHaveAttribute('data-kind', 'coupon');
    await expect(widget.panel.getByTestId('coupon-code')).toHaveCount(0);
  });

  test('TC-05-06 a refused copy says so and waits to be closed @T05', async ({ page, widget }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText: () => Promise.reject(new Error('denied')) },
        configurable: true,
      });
      document.execCommand = () => false;
    });
    await openPromo(widget);
    await widget.promoItems.filter({ hasText: 'BACK TO SCHOOL' }).getByRole('button', { name: /Copy/ }).click();
    const alert = widget.page.getByRole('alert');
    await expect(alert).toContainText("Couldn't copy the code");
    await alert.getByRole('button', { name: 'Close' }).click();
    await expect(alert).toHaveCount(0);
  });

  test('TC-05-07 while selecting, a promo row is ticked, not opened, and has no Copy @T05', async ({ page, widget }) => {
    await openPromo(widget);
    await widget.panel.getByRole('button', { name: 'Select', exact: true }).click();
    let opened = false;
    page.on('popup', () => (opened = true));
    const row = widget.notifItems.filter({ hasText: 'Mad Shade' });
    await row.getByRole('checkbox').click();
    await expect(row.getByRole('checkbox')).toHaveAttribute('aria-checked', 'true');
    await expect(widget.panel.getByRole('button', { name: /Copy/ })).toHaveCount(0);
    expect(opened).toBe(false);
  });
});
