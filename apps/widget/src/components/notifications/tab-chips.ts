import type { TabKey } from '../../store/widgetStore';

export interface ChipDef {
  key: string;
  labelKey: string;
}

/**
 * Chips that read the notification feed itself.
 * `all` is the catch-all view, `event` is coupons and campaigns.
 */
const NOTICE_CHIPS: ChipDef[] = [
  { key: 'all', labelKey: 'notifications.filters.all' },
  { key: 'event', labelKey: 'notifications.filters.event' },
];

/**
 * Chips about a shopper's orders. `inquiries` is a sixth chip the design does
 * not show (PLN-260817 §7 D-3) — it is the only home the shipped issue feed has.
 *
 * `orders` leads, and it is the order LIST rather than a notification filter.
 * It replaced a `payment` chip that read the notification feed: the Orders tab
 * opened on it, and across the whole staging database not one `payment`
 * notification had ever been written, so the tab named for orders opened empty
 * for every shopper (REQ-260818-Widget-Orders-Tab C-1). Payment notices still
 * reach the Notifications tab's `all`, so nothing was taken away.
 */
const ORDER_CHIPS: ChipDef[] = [
  { key: 'orders', labelKey: 'notifications.filters.orders' },
  { key: 'shipping', labelKey: 'notifications.filters.shipping' },
  { key: 'review', labelKey: 'notifications.filters.review' },
  { key: 'inquiries', labelKey: 'notifications.filters.inquiries' },
];

/** Tenant facts that change the chip bar beyond the tab layout itself. */
export interface ChipOptions {
  /**
   * The tenant runs an issue workflow (`workflow_mode` native/bridge), so the
   * shopper has an inquiry feed worth a chip. Only consulted by the single
   * list-tab bar — see chipsFor.
   */
  inquiries?: boolean;
}

/**
 * Which chips a given list tab shows, given the tenant's tab configuration
 * (PLN-260817-Widget-Tab-Config W-5).
 *
 * There are only two list-shaped tabs, notifications and orders. When both are
 * on they split the chips by subject; when only one is on it absorbs the other's
 * chips, because otherwise switching a tab off would silently delete features —
 * a shopper with the orders tab disabled must still be able to track a shipment.
 */
/**
 * The Master Shots' Order chip: the feed of order NOTICES (confirmed, shipped,
 * delivered…) — payment + shipping notifications, each drawn from the order it
 * names. Not the order list: that is `orders` above (ivy-docs T02 D1).
 */
export const ORDER_FEED_CHIP = 'order';

/** Notification categories the Order chip shows. */
export const ORDER_FEED_CATEGORIES: readonly string[] = ['payment', 'shipping'];

export function chipsFor(tab: TabKey, visibleTabs: TabKey[], opts: ChipOptions = {}): ChipDef[] {
  const bothPresent =
    visibleTabs.includes('notifications') && visibleTabs.includes('orders');
  if (bothPresent) return tab === 'orders' ? ORDER_CHIPS : NOTICE_CHIPS;
  // One list tab absorbs the other's chips, in the design's single bar
  // (ivy-docs SPEC BR-01, T02): Order · Delivery · Promo · Review. No "All"
  // (SPEC Q-10).
  //  - Order is the order-notice feed, which the API now writes for every
  //    recent order (T02 B2) — the old `payment` chip opened empty because
  //    nothing wrote one (REQ-260818 C-1).
  //  - Promo is the `event` feed under the design's name.
  //  - `chat` notices (the mobile app's) have no chip: they repeat the Chat tab.
  //  - `inquiries` is not in that design. It is the only home of the issue
  //    feed, so it stays for tenants that actually run an issue workflow and
  //    goes for everyone else, where it could only ever be empty (D-2).
  const [, shipping, review, inquiries] = ORDER_CHIPS;
  const chips: ChipDef[] = [
    { key: ORDER_FEED_CHIP, labelKey: 'notifications.filters.order' },
    shipping,
    { ...NOTICE_CHIPS[1], labelKey: 'notifications.filters.promo' },
    review,
  ];
  return opts.inquiries ? [...chips, inquiries] : chips;
}

/** The chip a tab starts on — always its own first. */
export function defaultChip(tab: TabKey, visibleTabs: TabKey[], opts: ChipOptions = {}): string {
  return chipsFor(tab, visibleTabs, opts)[0]?.key ?? 'all';
}

/** The rows the Order chip shows, from a feed that may hold other categories too. */
export function orderFeedRows<T extends { category: string }>(rows: readonly T[]): T[] {
  return rows.filter((n) => ORDER_FEED_CATEGORIES.includes(n.category));
}

/** What "Delete All" sends besides `all: true` — see deleteAllFilter. */
export interface DeleteAllFilter {
  categories?: string[];
  scope?: string;
}

/**
 * What "Delete All Notifications" deletes on a chip: exactly the rows that chip
 * lists, never another chip's (ivy-docs T07 §7-2a).
 *
 * - Order chip → its categories (payment + shipping). Not the `order` scope:
 *   that also holds review notices, which this bar does not list anywhere.
 * - `all` → what the list asked for: the tab's half of the feed when two list
 *   tabs split it (`scope`), the whole feed otherwise.
 * - any other notification chip (`event`) → that one category.
 */
export function deleteAllFilter(chip: string, scope?: string): DeleteAllFilter {
  if (chip === ORDER_FEED_CHIP) return { categories: [...ORDER_FEED_CATEGORIES] };
  if (chip === 'all') return scope ? { scope } : {};
  return { categories: [chip] };
}

/** True when `filter` is one this tab actually renders. */
export function chipBelongsTo(
  filter: string,
  tab: TabKey,
  visibleTabs: TabKey[],
  opts: ChipOptions = {},
): boolean {
  return chipsFor(tab, visibleTabs, opts).some((c) => c.key === filter);
}
