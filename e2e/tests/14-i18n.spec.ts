import { test, expect, type Lang } from '../fixtures/widget';

/** T14 — i18n completeness (BR-19, G-22). Labels per locale come from apps/widget/src/i18n/locales/*.ts. */
const TAB_LABELS: Record<Lang, [string, string]> = {
  en: ['Notifications', 'Chat'],
  es: ['Notificaciones', 'Chat'],
  ko: ['알림', '채팅'],
  vi: ['Thông báo', 'Trò chuyện'],
  ja: ['お知らせ', 'チャット'],
  zh: ['通知', '聊天'],
};

/** An untranslated i18n key leaking into the UI, e.g. "notifications.filters.all". */
const RAW_KEY = /\b(notifications|chat|orders|header|settings|a11y|tab|consent|privacy|csat|contact)\.[a-zA-Z_.]+\b/;

test.describe('T14 · i18n', () => {
  for (const lang of Object.keys(TAB_LABELS) as Lang[]) {
    test(`TC-14-01 [${lang}] tabs are localized and no raw keys leak @T14 @i18n @design`, async ({ widget }) => {
      await widget.goto({ lang });
      await widget.open();
      const [notif, chat] = TAB_LABELS[lang];
      await expect(widget.panel.getByRole('tab', { name: new RegExp(`^${notif}`) })).toBeVisible();
      await expect(widget.panel.getByRole('tab', { name: new RegExp(`^${chat}`) })).toBeVisible();
      await widget.panel.getByRole('tab', { name: new RegExp(`^${notif}`) }).click();
      expect(await widget.panel.innerText()).not.toMatch(RAW_KEY);
    });
  }

  test('TC-14-02 [ko] Korean copy matches the design @T14 @i18n @design', async ({ widget }) => {
    await widget.goto({ lang: 'ko' });
    await widget.open();
    await widget.panel.getByRole('tab', { name: /^알림/ }).click();
    for (const chip of ['주문', '배송', '프로모', '리뷰']) {
      await expect(widget.chip(chip)).toBeVisible();
    }
    await expect(widget.panel.getByText('오늘 받은 알림')).toBeVisible();
    await widget.panel.getByRole('button', { name: '선택', exact: true }).click();
    await expect(widget.panel.getByRole('button', { name: '선택 알림 삭제' })).toBeVisible();
    await expect(widget.panel.getByRole('button', { name: '전체 알림 삭제' })).toBeVisible();
  });

  test.describe('persistence (real API)', () => {
    test.use({ mockOptions: false });
    test('TC-14-03 the chosen language survives a reload @T14 @i18n @integration', async ({ page, widget }) => {
      await widget.goto();
      await widget.open();
      await widget.chooseLanguage('한국어');
      await expect(widget.panel.getByRole('tab', { name: /^채팅/ })).toBeVisible();
      await page.reload();
      await widget.open();
      await expect(widget.panel.getByRole('tab', { name: /^채팅/ })).toBeVisible();
    });
  });
});
