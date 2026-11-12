import type { ScenarioButton } from '../../lib/types';

/**
 * Chips shown under a reply that brought none of its own (the RAG path), so
 * the thread never ends at a dead end.
 *
 * A store gets its order chips. A tenant with no orders (PLN-261001 — a hotel
 * partner desk, a B2B help desk) gets its own scenario buttons instead: they
 * are already scoped to the session's AI agent and resolved to its language,
 * so the operator configures the menu and these chips in one place. "Talk to
 * an agent" closes the row either way.
 */
export interface ReplyChip {
  id: string;
  label: string;
  /** Set for a scenario button — clicking it behaves exactly as in the menu. */
  button?: ScenarioButton;
}

/**
 * Three plus the agent chip fits one or two rows of the docked panel; the full
 * set stays in the menu at the top of the thread.
 */
export const NON_COMMERCE_REPLY_CHIPS = 3;

export type ReplyChipLabels = Record<'myOrders' | 'shipping' | 'returns' | 'agent', string>;

export function replyChips(
  commerceEnabled: boolean,
  scenarioButtons: ScenarioButton[],
  labels: ReplyChipLabels,
): ReplyChip[] {
  const agent: ReplyChip = { id: 'agent_connect', label: labels.agent };
  if (commerceEnabled) {
    return [
      { id: 'my_orders', label: labels.myOrders },
      { id: 'shipping_policy', label: labels.shipping },
      { id: 'return_exchange', label: labels.returns },
      agent,
    ];
  }
  return [
    ...scenarioButtons
      .filter((b) => b.enabled !== false)
      .slice(0, NON_COMMERCE_REPLY_CHIPS)
      .map((b) => ({ id: b.id, label: b.label, button: b })),
    agent,
  ];
}

/** The shared "Start over" chip (SPEC BR-12): back to the opening menu. Widget-side, never a script. */
export const START_OVER_ID = 'start_over';
/** "Track delivery" after the order answer (ivy-docs T09): opens the Delivery chip. */
export const TRACK_DELIVERY_ID = 'track_delivery';
/** "Cancel order" after the order answer: the shipped `cancel_order` script. */
export const CANCEL_ORDER_ID = 'cancel_order';

/**
 * A scripted reply's chips plus Start over (BR-12: every scenario ends with a
 * way back to the menu). Never added twice, and never to a reply without
 * chips — a plain answer is not a scenario step.
 */
export function withStartOver<T extends { id: string; label: string }>(
  chips: readonly T[],
  startOverLabel: string,
): Array<T | { id: string; label: string }> {
  if (chips.length === 0 || chips.some((c) => c.id === START_OVER_ID)) return [...chips];
  return [...chips, { id: START_OVER_ID, label: startOverLabel }];
}

/**
 * Chips under the "My Orders" answer (SCR-IVY-11): Track delivery · Cancel
 * order · Start over. With no recent order the first two have nothing to act
 * on, so only Start over is left.
 */
export function orderAnswerChips(
  hasOrders: boolean,
  labels: { track: string; cancel: string; startOver: string },
): Array<{ id: string; label: string }> {
  const startOver = { id: START_OVER_ID, label: labels.startOver };
  if (!hasOrders) return [startOver];
  return [
    { id: TRACK_DELIVERY_ID, label: labels.track },
    { id: CANCEL_ORDER_ID, label: labels.cancel },
    startOver,
  ];
}

/** Product Help topics (ivy-docs T10 D1, Figma 1006:5588). */
export const PRODUCT_HELP_IDS = {
  POPULAR: 'popular_products',
  USAGE: 'usage',
  INGREDIENTS: 'ingredients',
  EXCHANGE: 'exchange_return',
  RESTOCK: 'restock_alert',
} as const;
/** "Other categories" under a popular-products answer. */
export const OTHER_CATEGORIES_ID = 'other_categories';

/**
 * The Product Help menu: Popular products first when the tenant listed store
 * categories (none = nothing to browse, so no chip), then the design's four
 * topics and Start over.
 */
export function productHelpChips(
  hasCategories: boolean,
  labels: Record<'popular' | 'usage' | 'ingredients' | 'exchange' | 'restock' | 'startOver', string>,
): Array<{ id: string; label: string }> {
  return [
    ...(hasCategories ? [{ id: PRODUCT_HELP_IDS.POPULAR, label: labels.popular }] : []),
    { id: PRODUCT_HELP_IDS.USAGE, label: labels.usage },
    { id: PRODUCT_HELP_IDS.INGREDIENTS, label: labels.ingredients },
    { id: PRODUCT_HELP_IDS.EXCHANGE, label: labels.exchange },
    { id: PRODUCT_HELP_IDS.RESTOCK, label: labels.restock },
    { id: START_OVER_ID, label: labels.startOver },
  ];
}

/**
 * Category chips, then Start over. A category whose handle happens to equal a
 * control id is still a category: callers tell them apart by `kind`.
 */
export function categoryChips(
  categories: ReadonlyArray<{ id: string; label: string }>,
  startOverLabel: string,
): Array<{ id: string; label: string; kind: 'category' | 'control' }> {
  return [
    ...categories.map((c) => ({ id: c.id, label: c.label, kind: 'category' as const })),
    { id: START_OVER_ID, label: startOverLabel, kind: 'control' as const },
  ];
}
