/**
 * Money for display. Amount and currency are nullable on the wire (an order or
 * line item can legitimately carry neither), so render a dash rather than "NaN"
 * or throwing — a missing price must never take the widget down.
 */
export function formatMoney(
  amount: number | null | undefined,
  currency: string | null | undefined = 'USD',
): string {
  if (amount == null || Number.isNaN(Number(amount))) return '—';
  const value = Number(amount);
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD',
    }).format(value);
  } catch {
    return `$${value.toFixed(2)}`;
  }
}

/**
 * `lng` is the active i18next code ('en', 'ko', 'vi', …). Passing it in keeps
 * this module pure — callers read it from `useTranslation()`. Before the six-language
 * work these formatters were pinned to 'en-US', which quietly served American
 * dates to Japanese and Vietnamese shoppers; the locale now follows the UI.
 */
export function formatDate(iso: string, lng = 'en'): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(lng, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function formatTime(iso: string, lng = 'en'): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString(lng, {
    hour: 'numeric',
    minute: '2-digit',
  });
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * "Just now" / "10 minutes ago" / "3 hours ago" / "4 months ago" — the timestamp
 * style the Master Shots use on every notification row (PLN-260817 W-1).
 *
 * `Intl.RelativeTimeFormat` rather than six sets of translation strings: it
 * already knows the plural rules and word order for every language in the
 * registry, and a seventh language would otherwise need new copy just to say
 * "3 hours ago".
 */
export function relativeTime(iso: string, lng = 'en'): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const diff = Date.now() - d.getTime();
  let rtf: Intl.RelativeTimeFormat;
  try {
    rtf = new Intl.RelativeTimeFormat(lng, { numeric: 'auto' });
  } catch {
    rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  }
  // Under a minute reads as "now" in every locale via numeric:'auto'.
  if (diff < MINUTE) return rtf.format(0, 'second');
  if (diff < HOUR) return rtf.format(-Math.floor(diff / MINUTE), 'minute');
  if (diff < DAY) return rtf.format(-Math.floor(diff / HOUR), 'hour');
  if (diff < 30 * DAY) return rtf.format(-Math.floor(diff / DAY), 'day');
  if (diff < 365 * DAY) return rtf.format(-Math.floor(diff / (30 * DAY)), 'month');
  return rtf.format(-Math.floor(diff / (365 * DAY)), 'year');
}

/**
 * A notification row's time (IVY PRD v1 slide 9, replacing SPEC BR-05): the
 * time elapsed since the notice was created, rounded down —
 * "Just now" (under a minute) · "N min ago" (1–59 minutes) ·
 * "N hours ago" (1–23 hours) · "N days ago" (24 hours on; 47 hours is 1 day).
 *
 * Elapsed time, never calendar days or dates: it reads the same in every time
 * zone, which is why the PRD dropped "Yesterday" and "Nov 3".
 *
 * Returns the parts, not text: the caller words them through i18n, and the
 * rules stay testable without it.
 */
export type NoticeTime = { unit: 'justNow' } | { unit: 'minutes' | 'hours' | 'days'; count: number };

export function noticeTime(iso: string, now: Date = new Date()): NoticeTime | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const diff = now.getTime() - d.getTime();
  // A clock a little ahead of ours must not print "-1 min ago".
  if (diff < MINUTE) return { unit: 'justNow' };
  if (diff < HOUR) return { unit: 'minutes', count: Math.floor(diff / MINUTE) };
  if (diff < DAY) return { unit: 'hours', count: Math.floor(diff / HOUR) };
  return { unit: 'days', count: Math.floor(diff / DAY) };
}

export interface ReadGroup<T> {
  key: 'new' | 'recent';
  items: T[];
}

/**
 * New (unread) and Recent (read), in that order (IVY PRD v1 slide 9). Rows keep
 * the order they came in — newest first — inside each group, and an empty group
 * is left out. `isNew` is the caller's: a row read while the widget is open
 * stays in New until the next open (rule 3), so "unread" alone cannot decide.
 */
export function groupByRead<T>(items: readonly T[], isNew: (item: T) => boolean): ReadGroup<T>[] {
  const groups: ReadGroup<T>[] = [
    { key: 'new', items: items.filter(isNew) },
    { key: 'recent', items: items.filter((it) => !isNew(it)) },
  ];
  return groups.filter((g) => g.items.length > 0);
}
