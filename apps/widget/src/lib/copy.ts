import type { WidgetCopyText } from './types';

/**
 * Tenant copy helpers (PLN-260808, shared since PLN-261019): the chat greeting,
 * the header title, the sender names and the launcher pill all resolve the same
 * way — the bag's text for the active language, or null so the caller falls back.
 */

/** Pick the tenant-configured copy for the active language, if any. */
export function pickCopy(bag: WidgetCopyText | undefined | null, language: string): string | null {
  const key = (language || 'en').toUpperCase() as keyof WidgetCopyText;
  return bag?.[key]?.trim() || null;
}

/** Substitute a template placeholder everywhere (ES2020-safe replaceAll). */
export function fill(template: string, key: string, value: string): string {
  return template.split(key).join(value);
}

/**
 * The name a shopper is greeted by: the first word of their name. Shopify
 * stores `firstName + " " + lastName`, so the first word is the first name; a
 * name without spaces (most CJK names) is returned whole. A multi-word first
 * name ("Mary Ann") keeps only its first word — the documented trade-off of
 * deriving it rather than storing it (PLN-261110-IVY-T01 D2).
 */
export function firstNameOf(name: string | null | undefined): string {
  return (name ?? '').trim().split(/\s+/)[0] ?? '';
}

/**
 * A tenant's signed-in greeting with the shopper's name filled in. `{firstName}`
 * is opt-in (PLN-261110-IVY-T01): only a tenant whose copy contains it greets by
 * first name — every other template, and the built-in default, keeps the full
 * name, because "first word = given name" does not hold for every language
 * (a Vietnamese name starts with the family name).
 */
export function greetingFor(template: string, name: string): string {
  return fill(fill(template, '{firstName}', firstNameOf(name) || name), '{name}', name);
}

/**
 * The welcome bubble's text (PLN-261023). The first-visit copy (agent greeting
 * or tenant bag) may carry `{name}`: with a known name it is used filled in —
 * so a tenant can write "Dear {name}, I'm Joydesk…" once — and only a template
 * without `{name}` hands over to the login greeting. Without a name the token
 * is dropped along with the space before it ("Dear {name}, hi" → "Dear, hi").
 */
export function welcomeGreeting(opts: {
  firstVisit: string;
  loginGreeting: string;
  name: string | null;
  shop: string;
}): string {
  const { firstVisit, loginGreeting, name, shop } = opts;
  const template = !name || firstVisit.includes('{name}') ? firstVisit : loginGreeting;
  const withShop = fill(template, '{shop}', shop);
  if (name) return fill(withShop, '{name}', name);
  return withShop.replace(/\s*\{name\}/g, '').replace(/^[\s,]+/, '');
}

/**
 * A tenant's AI disclosure line split around its terms link
 * (PLN-261023-Widget-Disclosure-Line-Copy D2): the first `[…]` pair is the
 * linked part — "Created by AI; apply [terms of service]". `link` is null when
 * the text has no brackets; the caller then appends its usual terms link.
 * An unmatched or empty bracket is left as text rather than guessed at.
 */
export function splitDisclosure(text: string): { before: string; link: string | null; after: string } {
  const m = /\[([^\]]+)\]/.exec(text);
  if (!m || !m[1].trim()) return { before: text, link: null, after: '' };
  return { before: text.slice(0, m.index), link: m[1], after: text.slice(m.index + m[0].length) };
}
