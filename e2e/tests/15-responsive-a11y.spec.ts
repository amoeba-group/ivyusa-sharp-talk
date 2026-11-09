import { test, expect, watchConsole } from '../fixtures/widget';

/** T15 — responsive layout & accessibility (NFR-02..NFR-04, G-23, G-24). */
test.describe('T15 · Responsive & a11y', () => {
  test('TC-15-01 on a phone the open panel fills the screen width @T15 @responsive @mobile-only', async ({ page, widget }) => {
    await widget.goto();
    await widget.open();
    const vw = page.viewportSize()!.width;
    const box = (await widget.panel.boundingBox())!;
    expect(box.width).toBeGreaterThanOrEqual(vw * 0.95);
    expect(box.x).toBeLessThanOrEqual(vw * 0.03);
  });

  test('TC-15-02 no console errors while visiting every tab and chip @T15 @a11y @smoke', async ({ page, widget }) => {
    const errors = watchConsole(page);
    await widget.goto();
    await widget.open();
    await widget.openNotifications();
    for (const chip of ['Order', 'Delivery', 'Promo', 'Review']) {
      const c = widget.chip(chip);
      if (await c.count()) await c.click();
    }
    await widget.openChat();
    await widget.settingsButton.click();
    expect(errors, errors.join('\n')).toEqual([]);
  });

  test('TC-15-03 focus moves into the panel and Esc closes it @T15 @a11y', async ({ page, widget }) => {
    await widget.goto();
    await widget.open();
    await page.keyboard.press('Tab');
    expect(await widget.panel.evaluate((el) => el.contains(document.activeElement))).toBe(true);
    await page.keyboard.press('Escape');
    await expect(widget.panel).toBeHidden();
  });

  test('TC-15-04 tabs expose aria-selected and filter chips expose aria-pressed @T15 @a11y', async ({ widget }) => {
    await widget.goto();
    await widget.open();
    await widget.openNotifications();
    await expect(widget.tab('Notifications')).toHaveAttribute('aria-selected', 'true');
    await expect(widget.tab('Chat')).toHaveAttribute('aria-selected', 'false');
    await widget.chip('Delivery').click();
    await expect(widget.chip('Delivery')).toHaveAttribute('aria-pressed', 'true');
    await expect(widget.chip('Order')).toHaveAttribute('aria-pressed', 'false');
  });
});
