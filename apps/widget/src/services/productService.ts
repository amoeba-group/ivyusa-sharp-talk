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

/** One product a Stock inquiry offers (IVY PRD v1 C-01). */
export interface StockProduct {
  handle: string;
  title: string;
  vendor: string | null;
  price: number | null;
  currency: string | null;
  imageUrl: string | null;
  productUrl: string;
  inStock: boolean;
}

/**
 * Products on sale that match the shopper's words, each with whether it can be
 * bought now — read live from the store by the API. `available: false` = the
 * store could not be read.
 */
export function searchStock(sessionToken: string, q: string): Promise<{ available: boolean; products: StockProduct[] }> {
  return apiClient.get<{ available: boolean; products: StockProduct[] }>('/products/stock', { session_token: sessionToken, q });
}
