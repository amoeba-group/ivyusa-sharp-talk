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

/** Calendar-day distance from today, ignoring clock time. */
function daysAgo(iso: string, now: Date = new Date()): number | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  // Rounded, not floored: a day across a DST change is 23 or 25 hours long.
  return Math.round((startOf(now) - startOf(d)) / DAY);
}

/**
 * A notification row's time, as the design writes it (ivy-docs SPEC BR-05, Q-02):
 * "Just now" · "10mins ago" · "3h ago" · "Yesterday" · "4 days ago" · "Nov 3".
 *
 * Days are calendar days in the shopper's own time zone (the browser's), the
 * same days the list is grouped by — so a row under "Yesterday's" says
 * "Yesterday" even when it is only 9 hours old. Within the last hour minutes
 * win over the calendar: an order placed 5 minutes before midnight is "5mins
 * ago", not "Yesterday".
 *
 * Returns the parts, not text: the caller words them through i18n, and the
 * rules stay testable without it.
 */
export type NoticeTime =
  | { unit: 'justNow' }
  | { unit: 'minutes' | 'hours' | 'days'; count: number }
  | { unit: 'yesterday' }
  | { unit: 'date'; sameYear: boolean };

export function noticeTime(iso: string, now: Date = new Date()): NoticeTime | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const diff = now.getTime() - d.getTime();
  // A clock a little ahead of ours must not print "-1mins ago".
  if (diff < MINUTE) return { unit: 'justNow' };
  if (diff < HOUR) return { unit: 'minutes', count: Math.floor(diff / MINUTE) };
  const days = daysAgo(iso, now) ?? 0;
  if (days <= 0) return { unit: 'hours', count: Math.max(1, Math.floor(diff / HOUR)) };
  if (days === 1) return { unit: 'yesterday' };
  if (days <= 6) return { unit: 'days', count: days };
  return { unit: 'date', sameYear: d.getFullYear() === now.getFullYear() };
}

/** "Nov 3" this year, "Nov 3, 2025" before it — in the UI language. */
export function shortDate(iso: string, lng = 'en', withYear = false): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(lng, {
    month: 'short',
    day: 'numeric',
    ...(withYear ? { year: 'numeric' } : {}),
  });
}

export interface DateGroup<T> {
  /** 'today' | 'yesterday' | null — null means `label` is already an absolute date. */
  relative: 'today' | 'yesterday' | null;
  label: string;
  items: T[];
}

/**
 * Groups by calendar day in the shopper's time zone, tagging the two most
 * recent days so the caller can render them as "Today's" / "Yesterday's"
 * (ivy-docs SPEC BR-04). Older days keep an absolute date, which is what a
 * shopper scrolling back needs. Groups follow the order of `items`.
 */
export function groupByDate<T extends { createdAt: string }>(
  items: T[],
  lng = 'en',
  now: Date = new Date(),
): DateGroup<T>[] {
  const map = new Map<string, DateGroup<T>>();
  for (const it of items) {
    const ago = daysAgo(it.createdAt, now);
    const relative = ago === 0 ? 'today' : ago === 1 ? 'yesterday' : null;
    const key = relative ?? formatDate(it.createdAt, lng);
    let group = map.get(key);
    if (!group) {
      group = { relative, label: key, items: [] };
      map.set(key, group);
    }
    group.items.push(it);
  }
  return Array.from(map.values());
}
