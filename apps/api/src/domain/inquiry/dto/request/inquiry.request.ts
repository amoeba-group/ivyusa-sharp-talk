import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { INQUIRY_EMAIL_MAX, INQUIRY_MESSAGE_MAX, INQUIRY_NAME_MAX } from '@sharptalk/types';

export const INQUIRY_STATUS = { OPEN: 'open', ANSWERED: 'answered' } as const;
export type InquiryStatus = (typeof INQUIRY_STATUS)[keyof typeof INQUIRY_STATUS];
export const INQUIRY_STATUS_VALUES: readonly InquiryStatus[] = Object.values(INQUIRY_STATUS);

/**
 * POST /inquiries — the widget's contact form (FR-044, ivy-docs T11 D3).
 *
 * The lengths here only stop an absurd payload; the real rules (required,
 * address shape, 2,000 characters after trimming) are `inquiryProblems()` in
 * the service — the same function the widget form runs.
 */
export class CreateInquiryRequest {
  @IsString() session_token: string;
  @IsOptional() @IsString() conversation_id?: string;
  @IsOptional() @IsString() order_id?: string;
  @IsString() @MaxLength(INQUIRY_NAME_MAX + 100) name: string;
  @IsString() @MaxLength(INQUIRY_EMAIL_MAX + 100) email: string;
  @IsString() @MaxLength(INQUIRY_MESSAGE_MAX + 500) message: string;
}

/**
 * Session-token query for widget inquiry list. `session_token` is optional:
 * the widget sends it in the X-Session-Token header (PRV-M7/FE-M3) and
 * @SessionToken() 401s when absent from both header and query.
 */
export class InquiryListQuery {
  @IsOptional() @IsString() session_token?: string;
  @IsOptional() @IsString() page?: string;
  @IsOptional() @IsString() size?: string;
}

/** GET /admin/inquiries */
export class AdminInquiryListQuery {
  @IsOptional() @IsIn([...INQUIRY_STATUS_VALUES, 'all']) status?: string;
  @IsOptional() @IsString() page?: string;
  @IsOptional() @IsString() size?: string;
}

/** PATCH /admin/inquiries/:id — no body = answered (the console's original call). */
export class UpdateInquiryStatusRequest {
  @IsOptional() @IsIn(INQUIRY_STATUS_VALUES as unknown as string[]) status?: InquiryStatus;
}
