import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useWidgetStore, type TabKey } from '../../store/widgetStore';
import { useUnreadCount } from '../../hooks/useNotifications';
import { markChatRead } from '../../services/notificationService';
import { useAnalytics } from '../../lib/analytics';
import { NOTIFICATION_SCOPE } from '../../lib/widget-tabs';
import { tabDefs, type TabDef } from './tab-defs';

/**
 * Shared state for the top and bottom tab bars (PLN-260817-Widget-Tab-Config).
 *
 * Both bars show the same tabs with the same counts, select them the same way
 * and take the same keys; only the markup differs. Keeping that here means a
 * badge rule or a keyboard fix applied once applies to both positions.
 */
export function useTabBar(): {
  defs: TabDef[];
  activeTab: TabKey;
  select: (key: TabKey) => void;
  countFor: (key: TabKey) => number;
  label: (def: TabDef) => string;
  onKeyDown: (e: React.KeyboardEvent, index: number) => void;
} {
  const { t } = useTranslation();
  const activeTab = useWidgetStore((s) => s.activeTab);
  const setActiveTab = useWidgetStore((s) => s.setActiveTab);
  const visibleTabs = useWidgetStore((s) => s.visibleTabs);
  const sessionToken = useWidgetStore((s) => s.sessionToken);
  const authenticated = useWidgetStore((s) => s.authenticated);
  const chatUnread = useWidgetStore((s) => s.chatUnread);
  const panelOpen = useWidgetStore((s) => s.panelOpen);
  const queryClient = useQueryClient();
  const analytics = useAnalytics();

  const defs = tabDefs(visibleTabs);
  const hasNotifications = visibleTabs.includes('notifications');
  const hasOrders = visibleTabs.includes('orders');
  // Only a widget showing BOTH list tabs splits the feed; with one, that tab
  // absorbs the other's chips and so must show the whole count.
  const split = hasNotifications && hasOrders;

  /**
   * Counts come from the server, one query per badge.
   *
   * They used to be derived by tallying a page of notification rows on the
   * client, which is wrong the moment a shopper has more unread than fits in a
   * page: the tally undercounts the orders half and the difference inflates the
   * notifications half. A count endpoint counts.
   */
  // The feed's own total. "An agent replied" is not in it: no chip lists that
  // notice, so the feed badge it raised could never be read away (BUG-041).
  const { data: total } = useUnreadCount(sessionToken, authenticated, NOTIFICATION_SCOPE.FEED);
  // …it is the Chat tab's instead, on top of the messages that arrived while
  // this page was showing another tab.
  const { data: chatNotices } = useUnreadCount(sessionToken, authenticated, NOTIFICATION_SCOPE.CHAT);
  const chatNoticeCount = chatNotices?.count ?? 0;
  // Staff answered (BUG-044): the reply may be in another of a signed-in
  // shopper's chats — ask where their chat is now, before they open it.
  const requestReidentify = useWidgetStore((s) => s.requestReidentify);
  const lastNoticeCount = useRef(chatNoticeCount);
  useEffect(() => {
    if (chatNoticeCount > lastNoticeCount.current) requestReidentify();
    lastNoticeCount.current = chatNoticeCount;
  }, [chatNoticeCount, requestReidentify]);

  // Looking at the chat is reading them: there is no row to tap for these.
  const readingChat = panelOpen && activeTab === 'chat';
  useEffect(() => {
    if (!readingChat || !sessionToken || !authenticated || chatNoticeCount === 0) return;
    let cancelled = false;
    markChatRead(sessionToken)
      .then(() => {
        if (!cancelled) void queryClient.invalidateQueries({ queryKey: ['unread-count'] });
      })
      .catch(() => {
        /* the badge simply stays until the next poll */
      });
    return () => {
      cancelled = true;
    };
  }, [readingChat, sessionToken, authenticated, chatNoticeCount, queryClient]);
  const { data: orderScoped } = useUnreadCount(
    split && authenticated ? sessionToken : null,
    authenticated,
    NOTIFICATION_SCOPE.ORDER,
  );
  const { data: noticeScoped } = useUnreadCount(
    split && authenticated ? sessionToken : null,
    authenticated,
    NOTIFICATION_SCOPE.NOTICE,
  );

  function countFor(key: TabKey): number {
    if (key === 'chat') return readingChat ? 0 : chatUnread + chatNoticeCount;
    if (!split) return total?.count ?? 0;
    return (key === 'orders' ? orderScoped?.count : noticeScoped?.count) ?? 0;
  }

  const select = (key: TabKey) => {
    setActiveTab(key);
    analytics.tabView(key);
  };

  /**
   * Arrow-key movement between tabs, which `role="tablist"` implies and neither
   * bar had. Paired with roving `tabIndex` in the bars themselves, so Tab
   * reaches the tab strip once and arrows move within it.
   */
  const onKeyDown = (e: React.KeyboardEvent, index: number) => {
    const last = defs.length - 1;
    let next: number | null = null;
    if (e.key === 'ArrowRight') next = index === last ? 0 : index + 1;
    else if (e.key === 'ArrowLeft') next = index === 0 ? last : index - 1;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = last;
    if (next == null) return;
    e.preventDefault();
    select(defs[next].key);
    // Follow focus, so the newly selected tab is also the focused one.
    (e.currentTarget.parentElement?.children[next] as HTMLElement | undefined)?.focus();
  };

  return { defs, activeTab, select, countFor, label: (def) => t(def.labelKey), onKeyDown };
}
