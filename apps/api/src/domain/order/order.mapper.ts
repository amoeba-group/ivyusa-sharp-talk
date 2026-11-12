import {
  internalToUiStatus,
  type OrderAddressResponse,
  type OrderDetailResponse,
  type OrderItemResponse,
  type OrderListItemResponse,
  type OrderLookupResponse,
  type ReviewItemResponse,
} from '@sharptalk/types';
import { OrderCache } from './entity/order-cache.entity';
import { OrderItem } from './entity/order-item.entity';
import type { ShopifyMailingAddress } from './shopify-admin.client';

/**
 * Response shapes live in `@sharptalk/types` so the widget consumes the same contract —
 * see the note there. Aliased locally to keep existing call sites readable.
 */
export type OrderSummary = OrderLookupResponse;
export type OrderListItem = OrderListItemResponse;
export type OrderItemView = OrderItemResponse;
export type ReviewItemView = ReviewItemResponse;
export type OrderDetailView = OrderDetailResponse;
export type OrderAddressView = OrderAddressResponse;

/** Blank → null, so the client never has to tell "" from absent. */
const text = (v: string | null | undefined): string | null => {
  const t = v?.trim();
  return t ? t : null;
};

/** Entity -> response mapping for orders (camelCase payloads). */
export class OrderMapper {
  private static uiStatus(order: OrderCache): string | null {
    return order.statusInternal ? internalToUiStatus(order.statusInternal) : order.statusUi;
  }

  static toSummary(order: OrderCache): OrderSummary {
    return {
      id: String(order.id),
      orderNumber: order.orderNumber,
      statusUi: this.uiStatus(order),
      total: order.total,
    };
  }

  static toListItem(
    order: OrderCache,
    summary: { count: number; firstTitle: string | null },
  ): OrderListItem {
    return {
      id: String(order.id),
      orderNumber: order.orderNumber,
      statusInternal: order.statusInternal,
      statusUi: this.uiStatus(order),
      total: order.total,
      currency: order.currency,
      createdAt: order.createdAt.toISOString(),
      orderedAt: order.orderedAt ? order.orderedAt.toISOString() : null,
      itemCount: summary.count,
      firstItemTitle: summary.firstTitle,
    };
  }

  /**
   * `imageUrl` here is the CATALOGUE guess. The line's own picture — stored
   * when the order carried one — wins: it is the variant the shopper actually
   * bought, not a lookalike matched by title.
   */
  static toItemView(item: OrderItem, imageUrl?: string | null): OrderItemView {
    return {
      id: String(item.id),
      title: item.title,
      optionText: item.optionText,
      qty: item.qty,
      price: item.price,
      imageUrl: item.imageUrl ?? imageUrl ?? null,
    };
  }

  /** A delivered line for the Review chip (PLN-260923 P3). */
  static toReviewItem(
    order: OrderCache,
    item: OrderItem,
    reviewed: boolean,
    imageUrl?: string | null,
  ): ReviewItemView {
    return {
      orderItemId: String(item.id),
      orderId: String(order.id),
      orderNumber: order.orderNumber,
      title: item.title,
      optionText: item.optionText,
      price: item.price,
      currency: order.currency,
      imageUrl: item.imageUrl ?? imageUrl ?? null,
      productUrl: item.productUrl ?? null,
      reviewed,
      orderedAt: new Date(order.orderedAt ?? order.createdAt).toISOString(),
    };
  }

  /**
   * A Shopify MailingAddress → the widget's address (ivy-docs T04). An address
   * with no line at all is no address: the design then shows "-".
   */
  static toAddress(a: ShopifyMailingAddress | null | undefined): OrderAddressView | null {
    if (!a) return null;
    const view: OrderAddressView = {
      name: text(a.name),
      address1: text(a.address1),
      address2: text(a.address2),
      city: text(a.city),
      province: text(a.province),
      zip: text(a.zip),
      country: text(a.country),
      countryCode: text(a.countryCodeV2)?.toUpperCase() ?? null,
      phone: text(a.phone),
    };
    return Object.values(view).some((v) => v != null) ? view : null;
  }

  static toDetail(
    order: OrderCache,
    items: OrderItem[],
    customer?: { name: string | null; email: string | null } | null,
    /** item id → catalogue picture, resolved by the service (PLN-260920 P4). */
    images?: Map<string, string>,
  ): OrderDetailView {
    return {
      id: String(order.id),
      orderNumber: order.orderNumber,
      statusInternal: order.statusInternal,
      statusUi: this.uiStatus(order),
      total: order.total,
      // `?? null` rather than passing the property through: the column is new,
      // so a row built before it existed reads `undefined`, which JSON drops
      // from the response entirely. Null is the answer the contract promises.
      subtotal: order.subtotal ?? null,
      discountTotal: order.discountTotal ?? null,
      shippingTotal: order.shippingTotal ?? null,
      itemQty: order.itemQty ?? null,
      currency: order.currency,
      createdAt: order.createdAt.toISOString(),
      orderedAt: order.orderedAt ? order.orderedAt.toISOString() : null,
      contactName: customer?.name ?? null,
      contactEmail: customer?.email ?? null,
      items: items.map((i) => this.toItemView(i, images?.get(String(i.id)) ?? null)),
    };
  }
}
