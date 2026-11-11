import { In, Repository } from 'typeorm';
import { OrderItem } from './entity/order-item.entity';

export interface OrderItemSummary {
  count: number;
  firstTitle: string | null;
}

/** Orders with no cached items still need a summary object, not a null hole. */
export const EMPTY_ITEM_SUMMARY: OrderItemSummary = { count: 0, firstTitle: null };

/**
 * "<first item> + N more" needs the line count and the first line's title per
 * order. Getting that from order *detail* would be one extra request per row, so
 * it is aggregated here: two fixed queries however many orders are asked for.
 * GROUP_CONCAT is deliberately avoided — its SEPARATOR must be a string literal,
 * so a title containing the separator would corrupt the split.
 *
 * Shared by the widget's order list (OrderService) and the order notices the
 * notification feed writes for it (NotificationService.ensureOrderNotices), so
 * both describe an order in the same words.
 */
export async function summarizeOrderItems(
  itemRepo: Repository<OrderItem>,
  orderIds: number[],
): Promise<Map<string, OrderItemSummary>> {
  if (orderIds.length === 0) return new Map();
  const counts = await itemRepo
    .createQueryBuilder('i')
    .select('i.order_id', 'oid')
    .addSelect('COUNT(*)', 'cnt')
    .addSelect('MIN(i.id)', 'first_id')
    .where('i.order_id IN (:...ids)', { ids: orderIds })
    .groupBy('i.order_id')
    .getRawMany<{ oid: string; cnt: string; first_id: string }>();

  const firstIds = counts.map((r) => Number(r.first_id)).filter((n) => Number.isFinite(n));
  const firstItems = firstIds.length ? await itemRepo.find({ where: { id: In(firstIds) } }) : [];
  const titleById = new Map(firstItems.map((i) => [String(i.id), i.title]));

  return new Map(
    counts.map((r) => [
      String(r.oid),
      { count: Number(r.cnt), firstTitle: titleById.get(String(r.first_id)) ?? null },
    ]),
  );
}

/**
 * English one-liner for a stored notification body: "Face Mask + 2 items"
 * (ivy-docs BR-08). Stored text is only the FALLBACK — the widget re-renders the
 * row in the shopper's language from the order itself — so backend English is
 * right here (CLAUDE.md §2: backend messages English, client localizes).
 */
export function orderSummaryText(summary: OrderItemSummary): string | null {
  const { count, firstTitle } = summary;
  if (!firstTitle) return count > 0 ? `${count} ${count === 1 ? 'item' : 'items'}` : null;
  const more = count - 1;
  return more > 0 ? `${firstTitle} + ${more} ${more === 1 ? 'item' : 'items'}` : firstTitle;
}
