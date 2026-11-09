import { test, expect } from '../fixtures/widget';

/** T01 — panel shell, header, two tabs, badges (SPEC SCR-IVY-01..03, G-01..G-03). */
test.describe('T01 · Panel shell, header & tabs', () => {
  test.describe('tenant configuration (real tabs/theme)', () => {
    test.use({ mockOptions: { patchTabs: false } });

    test('TC-01-01 panel shows exactly two tabs: Notifications and Chat @T01 @design', async ({ widget }) => {
      await widget.goto();
      await widget.open();
      await expect(widget.tabs).toHaveCount(2);
      await expect(widget.tab('Notifications')).toBeVisible();
      await expect(widget.tab('Chat')).toBeVisible();
      await expect(widget.tab('Orders')).toHaveCount(0);
    });

    test('TC-01-06 panel is 380px wide on desktop @T01 @design', async ({ widget }) => {
      await widget.goto();
      await widget.open();
      const box = await widget.panel.boundingBox();
      expect(box?.width).toBeGreaterThanOrEqual(378);
      expect(box?.width).toBeLessThanOrEqual(382);
    });
  });

  test('TC-01-02 header greets the identified shopper by first name @T01 @design', async ({ widget }) => {
    await widget.goto();
    await widget.open();
    await expect(widget.headerTitle).toHaveText('Hi, Kiho');
  });

  test('TC-01-03 Notifications tab badge shows the unread count @T01 @design', async ({ widget, mocks }) => {
    await widget.goto();
    await widget.open();
    const unread = mocks!.state.notifications.filter((n) => !n.read).length;
    await expect(widget.tabBadge(widget.tab('Notifications'), unread)).toBeVisible();
  });

  test.describe('empty feed', () => {
    test.use({ mockOptions: { emptyFeed: true } });
    test('TC-01-04 badge is hidden when nothing is unread @T01 @design', async ({ widget }) => {
      await widget.goto();
      await widget.open();
      await expect(widget.tab('Notifications').getByLabel(/unread/)).toHaveCount(0);
    });
  });

  test('TC-01-05 Close and Esc close the panel; reopening keeps the last tab @T01 @design', async ({ page, widget }) => {
    await widget.goto();
    await widget.open();
    await widget.openNotifications();
    await widget.closeButton.click();
    await expect(widget.panel).toBeHidden();
    await widget.open();
    await expect(widget.tab('Notifications')).toHaveAttribute('aria-selected', 'true');
    await page.keyboard.press('Escape');
    await expect(widget.panel).toBeHidden();
  });

  test('TC-01-07 Settings opens the privacy screen and Back returns to the tabs @T01 @design', async ({ widget }) => {
    await widget.goto();
    await widget.open();
    await widget.settingsButton.click();
    await expect(widget.panel.getByText('Chat & AI consent')).toBeVisible();
    await widget.panel.getByRole('button', { name: 'Back' }).click();
    await expect(widget.tab('Chat')).toBeVisible();
  });
});
