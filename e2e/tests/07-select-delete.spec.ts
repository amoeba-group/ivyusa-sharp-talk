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
});
