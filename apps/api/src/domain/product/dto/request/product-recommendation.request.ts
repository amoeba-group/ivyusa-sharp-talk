import { ArrayMaxSize, IsArray, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { REC_ADMIN_MAX, REC_MODES, REC_TYPES } from '../../product-recommendation.service';

/**
 * PUT /admin/recommended-products — one category × type (IVY PRD v1 A-01/A-02).
 * Shape only here; the service checks the category against the tenant's
 * Product Help buttons, the handles, and the period.
 */
export class SaveRecommendationRequest {
  @IsString() @MaxLength(255) category_handle: string;
  @IsIn(REC_TYPES as unknown as string[]) rec_type: string;
  @IsIn(REC_MODES as unknown as string[]) mode: string;
  @IsOptional() @IsArray() @ArrayMaxSize(REC_ADMIN_MAX) @IsString({ each: true }) @MaxLength(255, { each: true })
  product_handles?: string[];
  /** YYYY-MM-DD; empty = from now. */
  @IsOptional() @IsString() @MaxLength(32) starts_at?: string | null;
  /** YYYY-MM-DD; empty = open-ended. After it, the category answers in AI Auto again. */
  @IsOptional() @IsString() @MaxLength(32) ends_at?: string | null;
}

/** GET /admin/recommended-products/search */
export class SearchRecommendationProductsQuery {
  @IsString() @MaxLength(80) q: string;
}

/** GET /admin/recommended-products/preview */
export class PreviewRecommendationQuery {
  @IsString() @MaxLength(255) category: string;
  @IsIn(REC_TYPES as unknown as string[]) type: string;
}
