import { apiGetList, apiPost } from '@/lib/api-client';

export interface OrderRow {
  id: number;
  orderNumber: string;
  statusInternal?: string | null;
  statusUi?: string | null;
  total?: number | null;
  currency?: string | null;
  itemCount?: number;
  createdAt?: string;
  /** When the order was placed in the store; null for rows cached before the store sent it. */
  orderedAt?: string | null;
}

export interface OrderListParams {
  page: number;
  pageSize: number;
  /** Part of an order number; absent = every order. */
  q?: string;
}

export interface OrderLookupResult {
  found: number;
  items: OrderRow[];
}

/** What the store lookup accepts — the same shape the API validates. */
export const ORDER_NUMBER_PATTERN = /^#?[A-Za-z0-9._-]{1,31}$/;

export const ordersService = {
  list: (params: OrderListParams) =>
    apiGetList<OrderRow>('/admin/orders', {
      page: params.page,
      size: params.pageSize,
      ...(params.q ? { q: params.q } : {}),
    }),
  /** Fetch one order from the store by its number and cache it. */
  lookup: (orderNumber: string) =>
    apiPost<OrderLookupResult>('/admin/orders/lookup', { order_number: orderNumber }),
};
