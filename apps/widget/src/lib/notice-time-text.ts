import type { TFunction } from 'i18next';
import { noticeTime } from './format';

/**
 * "Just now" / "5 min ago" / "2 hours ago" / "3 days ago" (IVY PRD v1 slide 9),
 * in the UI language. Shared by the notification feed and the Review chip
 * (ivy-docs T06 D1) so the two never word time differently. `lng` is kept for
 * the callers' signature; the wording comes from i18n.
 */
export function noticeTimeText(t: TFunction, iso: string, _lng?: string): string {
  const p = noticeTime(iso);
  if (!p) return '';
  if (p.unit === 'justNow') return t('notifications.time.justNow');
  return t(`notifications.time.${p.unit}`, { count: p.count });
}
