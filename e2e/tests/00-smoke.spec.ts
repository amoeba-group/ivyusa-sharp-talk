import { test, expect, watchConsole } from '../fixtures/widget';

/**
 * T00 — environment baseline. Runs against the REAL local API (no mocks) and must pass
 * before any feature task starts. See ivy-docs/TEST-CASES.md §T00.
 */
test.use({ mockOptions: false });

test.describe('T00 · Environment smoke', () => {
  test('TC-00-01 API health is ok @T00 @smoke @integration', async ({ request }) => {
    const res = await request.get(`${process.env.E2E_RESOLVED_API_URL}/health`);
    expect(res.status()).toBe(200);
    expect((await res.json()).data.status).toBe('ok');
  });

  test('TC-00-02 storefront loads with the launcher and a clean console @T00 @smoke @integration', async ({ page, widget }) => {
    const errors = watchConsole(page);
    await widget.goto();
    await expect(widget.launcher).toBeVisible();
    expect(errors, errors.join('\n')).toEqual([]);
  });

  test('TC-00-03 launcher opens the support panel with a session @T00 @smoke @integration', async ({ page, widget }) => {
    const ensure = page.waitForResponse((r) => r.url().endsWith('/session/ensure') && r.request().method() === 'POST');
    await widget.goto();
    await widget.open();
    const res = await ensure;
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.data.sessionToken).toBeTruthy();
    await expect(widget.tab('Chat')).toBeVisible();
  });

  test('TC-00-04 accepting consent is saved by the API @T00 @smoke @integration', async ({ page, widget }) => {
    await widget.goto();
    await widget.open();
    const consent = page.waitForResponse((r) => r.url().endsWith('/session/consent'));
    await widget.panel.getByRole('button', { name: 'Accept', exact: true }).click();
    const res = await consent;
    expect(res.status()).toBe(201);
    expect((await res.json()).data.consentState).toBe('granted');
    await expect(widget.panel.getByText('We could not save your choice')).toHaveCount(0);
  });
});
