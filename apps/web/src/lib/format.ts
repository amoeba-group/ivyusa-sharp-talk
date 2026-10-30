import i18n from 'i18next';

/**
 * Display formats for lists (REQ-261030): the console language, no seconds.
 * `toLocaleString()` printed "10/30/2026, 4:06:00 PM" in every cell — the
 * seconds are noise in a list and the browser's locale is not always the
 * operator's chosen console language.
 */
const cache = new Map<string, Intl.DateTimeFormat>();
function fmt(key: string, opts: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const lang = i18n.language || 'en';
  const id = `${lang}|${key}`;
  let f = cache.get(id);
  if (!f) {
    try {
      f = new Intl.DateTimeFormat(lang, opts);
    } catch {
      f = new Intl.DateTimeFormat('en', opts);
    }
    cache.set(id, f);
  }
  return f;
}

function parse(value?: string | number | Date | null): Date | null {
  if (value == null || value === '') return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** "Oct 30, 2026, 4:06 PM" (per language). */
export function formatDateTime(value?: string | number | Date | null, empty = '—'): string {
  const d = parse(value);
  return d ? fmt('dt', { dateStyle: 'medium', timeStyle: 'short' }).format(d) : empty;
}

/** "Oct 30, 2026". */
export function formatDate(value?: string | number | Date | null, empty = '—'): string {
  const d = parse(value);
  return d ? fmt('d', { dateStyle: 'medium' }).format(d) : empty;
}

/** "3 min ago" / "in 2 days" style, falling back to the date beyond a week. */
export function formatRelative(value?: string | number | Date | null, empty = '—'): string {
  const d = parse(value);
  if (!d) return empty;
  const diff = (d.getTime() - Date.now()) / 1000;
  const abs = Math.abs(diff);
  const lang = i18n.language || 'en';
  let rtf: Intl.RelativeTimeFormat;
  try {
    rtf = new Intl.RelativeTimeFormat(lang, { numeric: 'auto' });
  } catch {
    rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  }
  if (abs < 60) return rtf.format(Math.round(diff), 'second');
  if (abs < 3600) return rtf.format(Math.round(diff / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), 'hour');
  if (abs < 7 * 86400) return rtf.format(Math.round(diff / 86400), 'day');
  return formatDate(d, empty);
}
