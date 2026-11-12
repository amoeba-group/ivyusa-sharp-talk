import { IsBoolean, IsIn, IsOptional, IsString, IsArray, ArrayMaxSize } from 'class-validator';
import { NOTIFICATION_CATEGORY, NOTIFICATION_SCOPE } from '@sharptalk/types';

/** Channels notifications can be delivered on. in_app is always-on/transactional. */
export const NOTIFICATION_CHANNELS = ['in_app', 'email', 'sms', 'web_push'] as const;

export class ReadNotificationRequest {
  @IsString() session_token: string;
}

/** Real categories a delete may name — not the 'all' sentinel, which is a list filter. */
const DELETABLE_CATEGORIES = Object.values(NOTIFICATION_CATEGORY).filter((c) => c !== 'all');

/**
 * Widget bulk delete (PLN-260916 P3): explicit ids, or everything the shopper has.
 *
 * With `all`, `categories` or `scope` narrows "everything" to the chip the
 * shopper is looking at (ivy-docs T07 §7-2a). `categories` wins when both are
 * sent. Neither = the whole feed, which is what older clients still ask for.
 */
export class DeleteNotificationsRequest {
  @IsString() session_token: string;
  @IsOptional() @IsArray() @ArrayMaxSize(200) ids?: number[];
  @IsOptional() @IsBoolean() all?: boolean;
  @IsOptional() @IsArray() @ArrayMaxSize(DELETABLE_CATEGORIES.length) @IsIn(DELETABLE_CATEGORIES, { each: true })
  categories?: string[];
  @IsOptional() @IsString() @IsIn(Object.values(NOTIFICATION_SCOPE)) scope?: string;
}

export class UpdatePrefRequest {
  @IsString() session_token: string;
  @IsString() @IsIn(NOTIFICATION_CHANNELS as unknown as string[]) channel: string;
  @IsString() category: string;
  @IsBoolean() enabled: boolean;
}

/**
 * Not currently bound to the controller (it reads the params individually), but
 * kept consistent with the other widget list queries: `session_token` must stay
 * optional because `@SessionToken()` takes it from the `X-Session-Token` header
 * (PRV-M7/FE-M3). Requiring it here would 400 every widget GET if wired up.
 */
export class ListNotificationsQuery {
  @IsOptional() @IsString() session_token?: string;
  @IsOptional() @IsString() category?: string;
  @IsOptional() @IsString() page?: string;
  @IsOptional() @IsString() size?: string;
}

/**
 * Marketing refusal (PLN-260817-Widget-Header-Prefs-Cleanup). One boolean, not
 * a grid: the server owns which categories count as marketing so the widget and
 * the delivery rules cannot disagree about it.
 */
export class SetMarketingOptOutRequest {
  // Carried in the body like the sibling PUT /prefs: @SessionToken() only reads
  // the header, query and path, so a body-only token would 401 here.
  @IsString()
  session_token: string;

  @IsBoolean()
  opt_out: boolean;
}
