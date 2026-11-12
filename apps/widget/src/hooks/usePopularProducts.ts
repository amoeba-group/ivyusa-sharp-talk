import { useQuery } from '@tanstack/react-query';
import { getPopularProducts } from '../services/productService';

/**
 * Keyed by session (which pins the tenant) and collection. The API caches the
 * store read for 15 minutes; asking again within a visit costs nothing either.
 * No retry: a slow store already cost the shopper four seconds, and the answer
 * has a store link to fall back on.
 */
export function usePopularProducts(sessionToken: string | null, category: string) {
  return useQuery({
    queryKey: ['popular-products', sessionToken, category],
    queryFn: () => getPopularProducts(sessionToken!, category),
    enabled: !!sessionToken,
    staleTime: 5 * 60_000,
    retry: false,
  });
}
