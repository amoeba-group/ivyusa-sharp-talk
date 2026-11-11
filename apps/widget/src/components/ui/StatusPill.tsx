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
 * A notification's status pill (ivy-docs T02 D3), from the badge text the API
 * stored. A status we know gets its translated label and its colour; any other
 * wording is shown as written, in the neutral tone, rather than coloured by
 * guesswork (BUG-011).
 */
export function StatusPill({ badge }: { badge: string | null | undefined }) {
  const { t } = useTranslation();
  const text = badge?.trim();
  if (!text) return null;
  const status = noticeStatus(text);
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
