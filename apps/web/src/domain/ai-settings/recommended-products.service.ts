import { apiGet, apiPut } from '@/lib/api-client';

/** A product card as the store returns it (IVY PRD v1 A-02/A-04). */
export interface RecProduct {
  handle: string;
  title: string;
  vendor: string | null;
  price: number | null;
  currency: string | null;
  imageUrl: string | null;
  productUrl: string;
  available?: boolean;
}

export type RecType = 'popular' | 'recommended' | 'new';
export type RecConfigMode = 'auto' | 'admin';

/** One category × type, as saved. */
export interface RecConfig {
  categoryHandle: string;
  recType: RecType | string;
  mode: RecConfigMode | string;
  productHandles: string[];
  startsAt: string | null;
  endsAt: string | null;
  updatedAt: string | null;
}

export interface RecHistoryItem {
  at: string;
  actor: string | null;
  target: string | null;
  metadata: { before?: RecConfig | null; after?: RecConfig } | null;
}

export interface RecView {
  categories: Array<{ id: string; label: unknown }>;
  types: RecType[];
  maxProducts: number;
  configs: RecConfig[];
  /** The picked products' cards, by handle. */
  products: Record<string, RecProduct>;
  history: RecHistoryItem[];
}

export interface RecPreview {
  available: boolean;
  /** admin | admin_fallback | auto | auto_bestseller */
  mode: string | null;
  products: RecProduct[];
}

export interface SaveRecBody {
  category_handle: string;
  rec_type: RecType;
  mode: RecConfigMode;
  product_handles: string[];
  starts_at: string | null;
  ends_at: string | null;
}

/** Recommended products (IVY PRD v1 A-01…A-04, PLN-261125-IVY-Recommended-Products). */
export const recommendedProductsService = {
  view: () => apiGet<RecView>('/admin/recommended-products'),
  save: (body: SaveRecBody) => apiPut<RecConfig>('/admin/recommended-products', body),
  search: (q: string) => apiGet<RecProduct[]>('/admin/recommended-products/search', { q }),
  preview: (category: string, type: RecType) =>
    apiGet<RecPreview>('/admin/recommended-products/preview', { category, type }),
};
