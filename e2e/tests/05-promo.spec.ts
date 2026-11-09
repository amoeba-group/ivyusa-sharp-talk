import { test, expect } from '../fixtures/widget';

/** T05 — Promo notifications: coupon vs event (SCR-IVY-07, G-09). `kind`/`couponCode` are PROPOSED fields. */
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
  });

  test('TC-05-04 tapping an event with a link opens it @T05 @design', async ({ page, widget }) => {
    const popup = page.waitForEvent('popup');
    await widget.promoItems.filter({ hasText: 'Mad Shade' }).click();
    expect((await popup).url()).toContain('ivyusa.com/collections/mad-shade');
  });
});
