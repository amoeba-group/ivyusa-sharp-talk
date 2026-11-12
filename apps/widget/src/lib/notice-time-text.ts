import type { TFunction } from 'i18next';
import { noticeTime, shortDate } from './format';

/**
 * "Just now" / "10mins ago" / "3h ago" / "Yesterday" / "4 days ago" / "Nov 3"
 * (SPEC BR-05), in the UI language. Shared by the notification feed and the
 * Review chip (ivy-docs T06 D1) so the two never word time differently.
 */
export function noticeTimeText(t: TFunction, iso: string, lng: string): string {
  const p = noticeTime(iso);
  if (!p) return '';
  switch (p.unit) {
    case 'justNow':
      return t('notifications.time.justNow');
    case 'yesterday':
      return t('notifications.time.yesterday');
    case 'date':
      return shortDate(iso, lng, !p.sameYear);
    default:
      return t(`notifications.time.${p.unit}`, { count: p.count });
  }
}
