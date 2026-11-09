import { test, expect } from '../fixtures/widget';

/**
 * T16 — production smoke on talk.ivyusa.com. Read-only: never sends chat messages or
 * changes consent on production. Runs only with E2E_TARGET=prod (`npm run test:prod`),
 * from a network the AWS ELB allowlists (BUG-004).
 */
test.use({ mockOptions: false });

test.describe('T16 · Production smoke (talk.ivyusa.com)', () => {
  const api = () => process.env.E2E_RESOLVED_API_URL!;
  const widgetUrl = () => process.env.E2E_RESOLVED_WIDGET_URL!;

  test('TC-16-01 API health is ok @T16 @prod', async ({ request }) => {
    const res = await request.get(`${api()}/health`);
    expect(res.status()).toBe(200);
    expect((await res.json()).data.status).toBe('ok');
  });

  test('TC-16-02 widget app and embed loader are served @T16 @prod', async ({ request }) => {
    expect((await request.get(widgetUrl())).status()).toBe(200);
    const loader = await request.get(new URL('embed.js', widgetUrl()).toString());
    expect(loader.status()).toBe(200);
    expect(loader.headers()['content-type']).toMatch(/javascript/);
  });

  test('TC-16-03 the widget opens on production @T16 @prod', async ({ page }) => {
    await page.goto(widgetUrl());
    await page.getByRole('button', { name: 'Open support' }).click();
    await expect(page.getByRole('dialog', { name: 'Support widget' })).toBeVisible();
  });
});
