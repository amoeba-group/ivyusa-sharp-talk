import { useTranslation } from 'react-i18next';
import { useLiveChatUnreadCount } from './live-chat.hooks';

/**
 * Live Chat's sidebar entry carries the signed-in staff member's unread
 * conversations (PLN-261119), so a customer waiting shows from any page.
 * Collapsed rail: a dot on the icon, with the number in its tooltip.
 */
export function LiveChatUnreadBadge({ collapsed }: { collapsed: boolean }) {
  const { t } = useTranslation('livechat');
  const { data } = useLiveChatUnreadCount();
  const n = data?.count ?? 0;
  if (n <= 0) return null;
  const label = t('unread.navBadge', { count: n });
  if (collapsed) {
    return (
      <span
        role="img"
        aria-label={label}
        title={label}
        className="absolute right-2 top-1.5 h-2 w-2 rounded-full bg-primary-600 ring-2 ring-white"
      />
    );
  }
  return (
    <span
      aria-label={label}
      title={label}
      data-testid="nav-unread"
      className="ml-auto min-w-[18px] shrink-0 rounded-full bg-primary-600 px-1.5 text-center text-[10px] font-semibold leading-4 text-white"
    >
      {n > 99 ? '99+' : n}
    </span>
  );
}
