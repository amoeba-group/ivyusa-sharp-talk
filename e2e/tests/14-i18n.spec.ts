import type { Locator } from '@playwright/test';
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

/** The Notifications chip bar per locale: Order, Delivery, Promo, Review, then the Select toggle. */
const CHIP_BAR: Record<Lang, string[]> = {
  en: ['Order', 'Delivery', 'Promo', 'Review', 'Select'],
  es: ['Pedido', 'Envío', 'Promos', 'Reseña', 'Seleccionar'],
  ko: ['주문', '배송', '프로모', '리뷰', '선택'],
  vi: ['Đơn hàng', 'Vận chuyển', 'Khuyến mãi', 'Đánh giá', 'Chọn'],
  ja: ['注文', '配送', 'プロモ', 'レビュー', '選択'],
  zh: ['订单', '配送', '优惠', '评价', '选择'],
};

/**
 * Korean words that a line break cut in two (TC-14-04): the text range of each
 * word must sit on one line. Hidden tabs stay mounted, so only rendered text counts.
 */
async function splitKoreanWords(scope: Locator): Promise<string[]> {
  return scope.evaluate((root) => {
    const split: string[] = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const text = node.textContent ?? '';
      if (!/[가-힣]/.test(text) || !node.parentElement?.getClientRects().length) continue;
      for (const m of text.matchAll(/\S+/g)) {
        if (m[0].length < 2 || m.index === undefined) continue;
        const range = document.createRange();
        range.setStart(node, m.index);
        range.setEnd(node, m.index + m[0].length);
        const lines = new Set(
          [...range.getClientRects()].filter((r) => r.width > 0.5).map((r) => Math.round(r.top)),
        );
        if (lines.size > 1) split.push(m[0]);
      }
    }
    return split;
  });
}

/**
 * Which of these buttons a clipping box cuts, wholly or in part (TC-14-07).
 * Playwright's "visible" ignores overflow clipping, so walk up the ancestors.
 */
async function cutOffButtons(scope: Locator, names: string[]): Promise<string[]> {
  return scope.evaluate((root, wanted) => {
    const shown = Array.from(root.querySelectorAll('button')).filter((b) => b.getClientRects().length > 0);
    return wanted.filter((name) => {
      const button = shown.find((b) => (b.textContent ?? '').trim() === name);
      if (!button) return true;
      const r = button.getBoundingClientRect();
      for (let a = button.parentElement; a; a = a.parentElement) {
        if (a === root || getComputedStyle(a).overflowX !== 'visible') {
          const box = a.getBoundingClientRect();
          if (r.left < box.left - 0.5 || r.right > box.right + 0.5) return true;
        }
        if (a === root) break;
      }
      return false;
    });
  }, names);
}

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

  test('TC-14-04 [ko] Korean wraps between words, never inside one @T14 @i18n @design', async ({ page, widget }) => {
    await widget.goto({ lang: 'ko' });
    await widget.open();
    await expect(page.locator('html')).toHaveCSS('word-break', 'keep-all');
    // The three places T14 found split: the greeting, and two Settings hints.
    await widget.panel.getByRole('tab', { name: /^채팅/ }).click();
    await expect(widget.panel.getByText(/무엇을 도와드릴까요\?/)).toBeVisible();
    expect(await splitKoreanWords(widget.panel)).toEqual([]);
    await widget.panel.getByRole('button', { name: '설정', exact: true }).click();
    await expect(widget.panel.getByText(/요청에만 적용됩니다/)).toBeVisible();
    await expect(widget.panel.getByText(/앱 내 알림은 유지됩니다/)).toBeVisible();
    expect(await splitKoreanWords(widget.panel)).toEqual([]);
  });

  for (const lang of ['ja', 'zh'] as const) {
    test(`TC-14-04 [${lang}] keeps the default line breaking (no spaces to break at) @T14 @i18n @design`, async ({ page, widget }) => {
      await widget.goto({ lang });
      await widget.open();
      await expect(page.locator('html')).toHaveCSS('word-break', 'normal');
    });
  }

  test('TC-14-05 delivery steps follow the widget language, right after a switch @T14 @i18n @design', async ({ widget }) => {
    // The mocked tracking answers in English whatever the language, as the
    // server does until it hears about the switch: the words must be the widget's.
    await widget.goto({ lang: 'en' });
    await widget.open();
    await widget.openNotifications();
    await widget.chip('Delivery').click();
    const steps = widget.deliveryCards.first().getByTestId('delivery-step');
    await expect(steps).toHaveText(['Preparing', 'Processing', 'In Transit', 'Delivered']);
    await widget.chooseLanguage('한국어');
    await expect(steps).toHaveText(['발송준비', '배송시작', '배송중', '배송완료']);
  });

  test('TC-14-06 [ko] copy follows the Korean design: 결제완료, 리뷰 쓰기, in-transit line, 외 N개 @T14 @i18n @design', async ({ widget }) => {
    await widget.goto({ lang: 'ko' });
    await widget.open();
    const p = widget.panel;
    await p.getByRole('tab', { name: /^알림/ }).click();
    await widget.chip('주문').click();
    await expect(p.locator('[data-testid="status-pill"][data-status="confirmed"]').first()).toHaveText('결제완료');
    await widget.chip('배송').click();
    await expect(p.getByText('고객님께 배송중입니다!', { exact: true }).first()).toBeVisible();
    await expect(widget.deliveryCards.getByText(/ 외 2개$/).first()).toBeVisible();
    await widget.chip('리뷰').click();
    const write = p.getByRole('button', { name: '리뷰 쓰기' }).or(p.getByRole('link', { name: '리뷰 쓰기' }));
    await expect(write.first()).toBeVisible();
  });

  test('TC-14-06 [en][vi] item summaries say "+ 2 items"; the yesterday band reads like the today band @T14 @i18n @design', async ({ page, widget }) => {
    await widget.goto({ lang: 'en' });
    await widget.open();
    await widget.openNotifications();
    await widget.chip('Delivery').click();
    await expect(widget.deliveryCards.getByText(/ \+ 2 items$/).first()).toBeVisible();
    await expect(widget.deliveryCards.getByText(/more items?$/)).toHaveCount(0);

    await page.evaluate(() => localStorage.setItem('ivy_lang', 'vi'));
    await page.reload();
    await widget.open();
    await widget.panel.getByRole('tab', { name: /^Thông báo/ }).click();
    await widget.chip('Đơn hàng').click();
    await expect(widget.panel.getByText('Thông báo hôm qua', { exact: true })).toBeVisible();
  });

  for (const lang of Object.keys(CHIP_BAR) as Lang[]) {
    test(`TC-14-07 [${lang}] every filter chip and the Select toggle are in full view @T14 @i18n @design`, async ({ widget }) => {
      await widget.goto({ lang });
      await widget.open();
      await widget.panel.getByRole('tab', { name: new RegExp(`^${TAB_LABELS[lang][0]}`) }).click();
      const names = CHIP_BAR[lang];
      await expect(widget.panel.getByRole('button', { name: names[names.length - 1], exact: true })).toBeVisible();
      expect(await cutOffButtons(widget.panel, names)).toEqual([]);
    });
  }

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
