import { ArrayMaxSize, IsArray, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

/** How many addresses one campaign may name (IVY PRD v1 N-04). */
export const CAMPAIGN_TARGET_MAX = 1000;

export class CreateCampaignRequest {
  @IsString() name: string;
  @IsOptional() @IsString() segment_ref?: string;
  @IsOptional() @IsObject() content?: Record<string, unknown>;
  /** Specific customers by email; absent or null = every customer (IVY PRD v1 N-04). */
  @IsOptional() @IsArray() @ArrayMaxSize(CAMPAIGN_TARGET_MAX) @IsString({ each: true }) @MaxLength(254, { each: true })
  target_emails?: string[] | null;
}

export class UpdateCampaignRequest {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() segment_ref?: string;
  /** Absent = unchanged; null = every customer; a list = those customers only. */
  @IsOptional() @IsArray() @ArrayMaxSize(CAMPAIGN_TARGET_MAX) @IsString({ each: true }) @MaxLength(254, { each: true })
  target_emails?: string[] | null;
  @IsOptional() @IsObject() content?: Record<string, unknown>;
  @IsOptional() @IsString() status?: string;
}
