/**
 * The cards the widget itself adds to a chat thread — Contact Support, the
 * contact form, Product Help, the My Orders answer — kept across a page change
 * (ivy-docs PLN-261119 chat continuity).
 *
 * They are not messages: nothing about them goes to the server, so a storefront
 * navigation (which reloads the widget) used to drop them while the messages
 * around them came back. This keeps them in the tab's own storage, tied to the
 * conversation they were added to.
 *
 * Deliberately `sessionStorage`: the cards belong to this visit in this tab. A
 * different device, or the same shopper tomorrow, gets the messages and not
 * the cards. Storage a browser blocks for an embedded frame simply means the
 * old behaviour — every call here is allowed to fail.
 */
const PREFIX = 'ivy.thread-inserts.';
const MAX_AGE_MS = 24 * 3_600_000;
const MAX_ITEMS = 40;

interface Stored<T> {
  conversationId: string | null;
  savedAt: number;
  items: T[];
}

/** Not the token itself: a storage key is readable by anything with this origin's storage. */
function keyFor(sessionToken: string): string {
  let h = 5381;
  for (let i = 0; i < sessionToken.length; i++) h = ((h << 5) + h + sessionToken.charCodeAt(i)) | 0;
  return `${PREFIX}${(h >>> 0).toString(36)}`;
}

/** The cards saved for this session IF they belong to this conversation; otherwise none. */
export function loadThreadInserts<T>(sessionToken: string, conversationId: string | null): T[] {
  try {
    const raw = sessionStorage.getItem(keyFor(sessionToken));
    if (!raw) return [];
    const stored = JSON.parse(raw) as Stored<T>;
    if (!stored || !Array.isArray(stored.items)) return [];
    if (Date.now() - Number(stored.savedAt) > MAX_AGE_MS) return [];
    // A different conversation's cards would land in the middle of this one.
    if ((stored.conversationId ?? null) !== (conversationId ?? null)) return [];
    return stored.items;
  } catch {
    return [];
  }
}

export function saveThreadInserts<T>(sessionToken: string, conversationId: string | null, items: T[]): void {
  try {
    const key = keyFor(sessionToken);
    if (!items.length) {
      sessionStorage.removeItem(key);
      return;
    }
    const stored: Stored<T> = { conversationId: conversationId ?? null, savedAt: Date.now(), items: items.slice(-MAX_ITEMS) };
    sessionStorage.setItem(key, JSON.stringify(stored));
  } catch {
    /* storage blocked or full — the cards just do not survive a reload */
  }
}

export function clearThreadInserts(sessionToken: string): void {
  try {
    sessionStorage.removeItem(keyFor(sessionToken));
  } catch {
    /* nothing to clear */
  }
}
