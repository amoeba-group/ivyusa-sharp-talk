import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, MaxLength, ValidateIf } from 'class-validator';
import { CALLBACK_CHANNEL_VALUES, CALLBACK_SOURCE, CALLBACK_STATUS_VALUES } from '@sharptalk/types';

/** Request DTOs — snake_case (amoeba_code_convention). */

/** POST /callback — the widget's "contact me" (PLN-261026 B4/B6). */
export class CreateCallbackRequest {
  @IsString() session_token: string;
  @Type(() => Number) @IsInt() conversation_id: number;
  @IsIn(Object.values(CALLBACK_SOURCE)) source: string;
  /** Required for `entered`; for `member` it narrows to one kind when given. */
  @ValidateIf((o: CreateCallbackRequest) => o.source === CALLBACK_SOURCE.ENTERED || o.channel !== undefined)
  @IsIn(CALLBACK_CHANNEL_VALUES as unknown as string[])
  channel?: string;
  @ValidateIf((o: CreateCallbackRequest) => o.source === CALLBACK_SOURCE.ENTERED)
  @IsString()
  @MaxLength(255)
  contact?: string;
}

/** GET /callback-requests */
export class ListCallbacksQuery {
  @IsOptional() @IsIn([...CALLBACK_STATUS_VALUES, 'all']) status?: string;
  @IsOptional() @Type(() => Number) @IsInt() conversation_id?: number;
  @IsOptional() @IsString() page?: string;
  @IsOptional() @IsString() size?: string;
}

/** PATCH /callback-requests/:id */
export class UpdateCallbackStatusRequest {
  @IsIn(CALLBACK_STATUS_VALUES as unknown as string[]) status: string;
}
