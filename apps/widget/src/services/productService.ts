import { apiClient } from '../lib/api-client';
import type { PopularProducts } from '../lib/types';

/**
 * Best sellers of one Product Help category (ivy-docs T10 D3), read live from
 * the store by the API. `category` is the collection handle from the tenant's
 * Product Help button.
 */
export function getPopularProducts(sessionToken: string, category: string): Promise<PopularProducts> {
  return apiClient.get<PopularProducts>('/products/popular', { session_token: sessionToken, category });
}
