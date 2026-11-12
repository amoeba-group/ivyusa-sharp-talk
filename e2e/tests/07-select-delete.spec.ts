import { test, expect } from '../fixtures/widget';

/** T07 — selection mode & delete (SCR-IVY-09, G-11, BR-09). */
test.describe('T07 · Select & delete notifications', () => {
  test.beforeEach(async ({ page, widget }) => {
    // Native confirm()/alert() is not part of the design — fail loudly if one appears.
    page.on('dialog', async (d) => {
      await d.dismiss();
      throw new Error(`Unexpected native ${d.type()} dialog: ${d.message()}`);
    });
    await widget.goto();
    await widget.open();
    await widget.openNotifications();
    await widget.panel.getByRole('button', { name: 'Select', exact: true }).click();
  });

  test('TC-07-01 Delete Selected Notifications deletes exactly the checked rows @T07 @design', async ({ widget, mocks }) => {
    const boxes = widget.notifItems.getByRole('checkbox');
    await expect(boxes.first()).toBeVisible();
    const before = await widget.notifItems.count();
    const ids = await widget.notifItems.evaluateAll((els) => els.slice(0, 2).map((e) => e.getAttribute('data-id')));
    await boxes.nth(0).click();
    await boxes.nth(1).click();
    await expect(boxes.nth(0)).toHaveAttribute('aria-checked', 'true');
    await widget.panel.getByRole('button', { name: 'Delete Selected Notifications' }).click();
    await expect.poll(() => mocks!.callsTo('DELETE', '/notifications').length).toBe(1);
    expect(mocks!.callsTo('DELETE', '/notifications')[0].body.ids.map(String).sort()).toEqual(ids.map(String).sort());
    await expect(widget.notifItems).toHaveCount(before - 2);
    await expect(widget.page.getByRole('status').or(widget.page.getByRole('alert'))).toContainText(/deleted/i);
  });

  test('TC-07-02 Delete All Notifications asks inside the panel, then empties the list @T07 @design', async ({ widget, mocks }) => {
    await widget.panel.getByRole('button', { name: 'Delete All Notifications' }).click();
    await widget.panel.getByRole('button', { name: /^(Delete|Confirm)$/ }).click();
    await expect.poll(() => mocks!.callsTo('DELETE', '/notifications').length).toBe(1);
    expect(mocks!.callsTo('DELETE', '/notifications')[0].body.all).toBe(true);
    await expect(widget.notifItems).toHaveCount(0);
  });

  test('TC-07-03 Cancel leaves selection mode without deleting @T07 @design', async ({ widget, mocks }) => {
    await widget.panel.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(widget.notifItems.getByRole('checkbox')).toHaveCount(0);
    expect(mocks!.callsTo('DELETE', '/notifications')).toHaveLength(0);
  });

  test('TC-07-04 Delete All on the Order chip keeps the other chips (PLN §7-2a) @T07', async ({ widget, mocks }) => {
    await widget.panel.getByRole('button', { name: 'Delete All Notifications' }).click();
    const confirm = widget.panel.getByRole('alertdialog');
    await expect(confirm).toContainText('Order');
    await confirm.getByRole('button', { name: 'Delete', exact: true }).click();
    await expect.poll(() => mocks!.callsTo('DELETE', '/notifications').length).toBe(1);
    expect(mocks!.callsTo('DELETE', '/notifications')[0].body).toMatchObject({ all: true, categories: ['payment', 'shipping'] });
    await expect(widget.page.getByRole('status')).toHaveText('3 notifications deleted');
    await expect(widget.notifItems).toHaveCount(0);
    await widget.chip('Promo').click();
    await expect(widget.notifItems).toHaveCount(3);
  });

  test('TC-07-05 the confirm opens on Cancel and Esc closes only the confirm @T07', async ({ widget, mocks }) => {
    await widget.panel.getByRole('button', { name: 'Delete All Notifications' }).click();
    const confirm = widget.panel.getByRole('alertdialog');
    await expect(confirm.getByRole('button', { name: 'Cancel', exact: true })).toBeFocused();
    await widget.page.keyboard.press('Escape');
    await expect(confirm).toHaveCount(0);
    await expect(widget.panel).toBeVisible();
    await expect(widget.panel.getByRole('button', { name: 'Delete All Notifications' })).toBeFocused();
    await expect(widget.notifItems.getByRole('checkbox').first()).toBeVisible();
    expect(mocks!.callsTo('DELETE', '/notifications')).toHaveLength(0);
  });

  test('TC-07-06 each checkbox is named by its row @T07', async ({ widget }) => {
    await expect(widget.notifItems.getByRole('checkbox', { name: 'Select IVY-39891' })).toHaveCount(1);
  });
});

test.describe('T07 · Delete fails', () => {
  test.use({ mockOptions: { failures: { 'DELETE /notifications': 500 } } });

  test('TC-07-07 a failed delete says so and keeps the selection @T07', async ({ widget, mocks }) => {
    await widget.goto();
    await widget.open();
    await widget.openNotifications();
    await widget.panel.getByRole('button', { name: 'Select', exact: true }).click();
    const before = await widget.notifItems.count();
    const first = widget.notifItems.getByRole('checkbox').first();
    await first.click();
    await widget.panel.getByRole('button', { name: 'Delete Selected Notifications' }).click();
    const alert = widget.page.getByRole('alert');
    await expect(alert).toContainText("Couldn't delete notifications");
    expect(mocks!.callsTo('DELETE', '/notifications')).toHaveLength(1);
    await expect(first).toHaveAttribute('aria-checked', 'true');
    await expect(widget.notifItems).toHaveCount(before);
    // An error waits for the shopper, then goes when closed.
    await widget.page.waitForTimeout(3_500);
    await expect(alert).toBeVisible();
    await alert.getByRole('button', { name: 'Close' }).click();
    await expect(alert).toHaveCount(0);
  });
});
