import type {
  NotificationPrefResponse,
  NotificationResponse,
} from '@sharptalk/types';
import { Notification } from './entity/notification.entity';
import { NotificationPref } from './entity/notification-pref.entity';
import type { NotificationPromo } from './notification-promo.service';

/**
 * Map a notification row to the camelCase response shape (read flag derived).
 * `promo` is the row's campaign kind + code, when it points at one (T05).
 */
export function toNotificationResponse(n: Notification, promo?: NotificationPromo): NotificationResponse {
  return {
    id: String(n.id),
    category: n.category,
    title: n.title,
    body: n.body,
    statusBadge: n.statusBadge,
    linkUrl: n.linkUrl,
    refType: n.refType,
    refId: n.refId != null ? String(n.refId) : null,
    channel: n.channel,
    read: n.readAt != null,
    readAt: n.readAt ? n.readAt.toISOString() : null,
    createdAt: n.createdAt.toISOString(),
    kind: promo?.kind ?? null,
    couponCode: promo?.couponCode ?? null,
  };
}

/** Map a preference row to a camelCase response shape. */
export function toPrefResponse(p: NotificationPref): NotificationPrefResponse {
  return {
    id: String(p.id),
    channel: p.channel,
    category: p.category,
    enabled: p.enabled === 1,
  };
}
