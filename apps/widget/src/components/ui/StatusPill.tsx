import { useTranslation } from 'react-i18next';
import { Badge } from './Badge';
import {
  NOTICE_STATUS,
  noticeStatus,
  type NoticeStatus,
} from '../../../../../packages/types/src/common/order-status';

/**
 * Colour per status (ivy-docs SPEC §4): Confirmed green, In Transit orange,
 * Delivered grey, Review purple. The tones are the design tokens the order
 * list's pills already use, so the same status looks the same on both screens.
 */
const TONE: Record<NoticeStatus, string> = {
  [NOTICE_STATUS.CONFIRMED]: 'success',
  [NOTICE_STATUS.IN_TRANSIT]: 'warning',
  [NOTICE_STATUS.DELIVERED]: 'neutral',
  [NOTICE_STATUS.REVIEW]: 'review',
  [NOTICE_STATUS.PENDING_PAYMENT]: 'default',
  [NOTICE_STATUS.CANCEL_REQUESTED]: 'error',
};

/**
 * A status pill (ivy-docs T02 D3). Either from the badge text the API stored on
 * a notification, or from a status code the caller already worked out (the
 * delivery card knows it from the tracking step — T03 D4). A status we know
 * gets its translated label and its colour; any other wording is shown as
 * written, in the neutral tone, rather than coloured by guesswork (BUG-011).
 */
export function StatusPill({
  badge,
  status: known,
}: {
  badge?: string | null;
  status?: NoticeStatus | null;
}) {
  const { t } = useTranslation();
  const text = badge?.trim();
  const status = known ?? (text ? noticeStatus(text) : null);
  if (!status && !text) return null;
  return (
    <Badge
      tone={status ? TONE[status] : 'default'}
      data-testid="status-pill"
      data-status={status ?? 'other'}
      className="flex-shrink-0"
    >
      {status ? t(`notifications.status.${status}`) : text}
    </Badge>
  );
}
