import { useQuery } from '@tanstack/react-query';
import {
  getOrder,
  getOrderAddresses,
  getTracking,
  listOrders,
  listReviewItems,
} from '../services/orderService';

/**
 * `opts` is part of the query key on purpose: the chat card asks for 10/30 and
 * the Orders tab for 20/90, and one cache entry serving both would let whichever
 * mounted first decide what the other sees.
 */
export function useOrders(
  sessionToken: string | null,
  enabled = true,
  opts: { size?: number; days?: number } = {},
) {
  return useQuery({
    queryKey: ['orders', sessionToken, opts.size ?? null, opts.days ?? null],
    queryFn: () => listOrders(sessionToken!, opts),
    enabled: !!sessionToken && enabled,
  });
}

export function useOrder(id: string | null, sessionToken: string | null) {
  return useQuery({
    queryKey: ['order', id, sessionToken],
    queryFn: () => getOrder(id!, sessionToken!),
    enabled: !!id && !!sessionToken,
  });
}

export function useTracking(id: string | null, sessionToken: string | null) {
  return useQuery({
    queryKey: ['tracking', id, sessionToken],
    queryFn: () => getTracking(id!, sessionToken!),
    enabled: !!id && !!sessionToken,
  });
}

/**
 * Order Detail addresses (ivy-docs T04). Kept 5 minutes: each fetch is a live
 * call to the store, and an address does not change while the shopper looks.
 * No retry: a refusal is an answer (`available: false`), and a failure should
 * hide the block quickly rather than keep the placeholder spinning.
 */
export function useOrderAddresses(id: string | null, sessionToken: string | null) {
  return useQuery({
    queryKey: ['order-addresses', id, sessionToken],
    queryFn: () => getOrderAddresses(id!, sessionToken!),
    enabled: !!id && !!sessionToken,
    staleTime: 5 * 60_000,
    retry: false,
  });
}

/** Review chip list (PLN-260923 P3). Keyed per token; invalidated after an in-widget review. */
export function useReviewItems(sessionToken: string | null, enabled = true) {
  return useQuery({
    queryKey: ['review-items', sessionToken],
    queryFn: () => listReviewItems(sessionToken!),
    enabled: !!sessionToken && enabled,
    staleTime: 60_000,
  });
}
