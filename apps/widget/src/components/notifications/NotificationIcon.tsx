import { Gift, MessageCircle, Package, Sparkles } from 'lucide-react';

/**
 * The round type badge on every notification row (PLN-260817 G-08, frames 34/46).
 *
 * Derived entirely from `NotificationResponse.category`, which the API already
 * sends — the design's three visual types map onto categories that exist, so
 * this needed no new column and no backfill.
 */
type Shape = { icon: typeof Package; ring: string; glyph: string };

const ORDERISH: Shape = { icon: Package, ring: 'bg-gray-100', glyph: 'text-gray-700' };

const SHAPES: Record<string, Shape> = {
  // Order lifecycle — the muted default, because most rows are these.
  payment: ORDERISH,
  shipping: ORDERISH,
  review: ORDERISH,
  // An `event` row with no kind and no link: the coupon look (T05 D3).
  event: { icon: Gift, ring: 'bg-promo-coupon', glyph: 'text-white' },
  chat: { icon: MessageCircle, ring: 'bg-primary-100', glyph: 'text-primary-700' },
  issue: { icon: MessageCircle, ring: 'bg-primary-100', glyph: 'text-primary-700' },
};

/**
 * Promo kinds (ivy-docs SPEC §4, T05): a coupon is a white gift on deep navy
 * #1A2E6B, an event a white sparkle on magenta #E91E8C.
 */
const COUPON: Shape = { icon: Gift, ring: 'bg-promo-coupon', glyph: 'text-white' };
const EVENT: Shape = { icon: Sparkles, ring: 'bg-promo-event', glyph: 'text-white' };

export function NotificationIcon({
  category,
  kind = null,
  hasLink = false,
  highlighted = false,
}: {
  category: string;
  /** Promo kind (lib/promo `promoKind`), when the row is a promo. Wins over the link guess. */
  kind?: 'coupon' | 'event' | null;
  /**
   * Campaigns and coupons are both stored as `event`, so category alone cannot
   * tell them apart. A campaign is the only `event` that carries a deep link
   * (`linkUrl`, the campaign product/url from A-9) — that is the distinction the
   * design draws between the pink promo rows and the dark coupon rows.
   */
  hasLink?: boolean;
  highlighted?: boolean;
}) {
  const shape =
    kind === 'coupon'
      ? COUPON
      : kind === 'event' || (category === 'event' && hasLink)
        ? EVENT
        : (SHAPES[category] ?? ORDERISH);
  const Icon = shape.icon;
  // On the highlighted row the gray ring would vanish into the cream wash, so
  // only the neutral rings get re-tinted — a colored ring already stands out.
  const ring = highlighted && shape.ring === 'bg-gray-100' ? 'bg-highlight-icon' : shape.ring;
  return (
    <span
      aria-hidden="true"
      data-testid={category === 'event' ? 'promo-icon' : undefined}
      className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full ${ring}`}
    >
      <Icon className={`h-[18px] w-[18px] ${shape.glyph}`} />
    </span>
  );
}
