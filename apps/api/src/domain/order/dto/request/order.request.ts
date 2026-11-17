import { IsEmail, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

/** POST /orders/guest-lookup — verify identity by order number + email (FR-019). */
export class GuestLookupRequest {
  @IsString() session_token: string;
  @IsString() @MinLength(1) order_number: string;
  @IsEmail() email: string;
}

/**
 * Optional pagination query for widget order lists.
* `session_token` is optional here: the widget sends it in the X-Session-Token
 * header (PRV-M7/FE-M3) and @SessionToken() rejects with 401 when absent from
 * both header and query — a required query field would 400 every header-auth call.
 */
export class OrderListQuery {
  @IsOptional() @IsString() session_token?: string;
  @IsOptional() @IsString() page?: string;
  @IsOptional() @IsString() size?: string;
  /** Only orders placed in the last N days (1–90); absent = no window. */
  @IsOptional() @IsString() days?: string;
}

/** GET /admin/orders — console order list, optionally narrowed to an order number. */
export class AdminOrderListQuery {
  @IsOptional() @IsString() page?: string;
  @IsOptional() @IsString() size?: string;
  /** Part of an order number; a leading "#" is ignored. */
  @IsOptional() @IsString() @MaxLength(32) q?: string;
}

/** POST /admin/orders/lookup — fetch one order from the store by its number. */
export class AdminOrderLookupRequest {
  @IsString()
  @MaxLength(32)
  @Matches(/^#?[A-Za-z0-9._-]+$/)
  order_number: string;
}

/** POST /webhooks/fulfillment — external fulfillment update (FR-021). */
export class FulfillmentWebhookRequest {
  @IsString() order_id: string;
  @IsString() status: string;
  @IsOptional() @IsString() tracking_number?: string;
  @IsOptional() @IsString() carrier?: string;
}
