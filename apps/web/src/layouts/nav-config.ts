import {
  LayoutDashboard,
  MessagesSquare,
  SquareKanban,
  History,
  Route,
  ClipboardList,
  BarChart3,
  Bot,
  BookOpen,
  Users,
  ShoppingCart,
  Package,
  Megaphone,
  Star,
  UserCog,
  Settings,
  Building2,
  Cpu,
  ScrollText,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react';
// Type-only: @sharptalk/types ships CJS whose runtime exports Rollup cannot see.
import type { MenuCode } from '@sharptalk/types';
import type { Capability } from '@/lib/rbac';

export interface NavItem {
  to: string;
  labelKey: string; // i18n key in the `nav` namespace
  icon: LucideIcon;
  /**
   * Catalog code the server judges visibility by (PLN-260812). One code per
   * SCREEN — which is why the issue board, the product list and the privacy
   * notice each have their own even though they used to share a capability
   * with a neighbour and could never be provisioned apart from it.
   */
  code?: MenuCode;
  /** Legacy local gate; used only when the server's menu list is unavailable. */
  capability?: Capability;
  /** Admin nav only: shown to super_admin, hidden from admin-level operators. */
  superAdminOnly?: boolean;
  /** Extra words the ⌘K search should match (English, lower case). */
  keywords?: string[];
}

/**
 * Sidebar sections (REQ-261030). Sixteen flat entries read as a wall; grouped by
 * the job an operator is doing, the eye finds "where do I answer customers" vs
 * "where do I configure the AI" without reading every line. Order inside a
 * group is the order of everyday use.
 */
export interface NavGroup {
  key: string; // i18n key in `nav.groups`
  items: NavItem[];
}

export const TENANT_NAV_GROUPS: NavGroup[] = [
  {
    key: 'overview',
    items: [
      { to: '/dashboard', labelKey: 'dashboard', icon: LayoutDashboard, code: 'dashboard', capability: 'dashboard', keywords: ['home', 'kpi'] },
    ],
  },
  {
    key: 'conversations',
    items: [
      { to: '/live-chat', labelKey: 'liveChat', icon: MessagesSquare, code: 'live_chat', capability: 'live_chat', keywords: ['chat', 'inbox', 'agent', 'alarm'] },
      // Issue board (P4) — same holders as live chat; non-native tenants get a notice.
      { to: '/issues', labelKey: 'issueBoard', icon: SquareKanban, code: 'issues', capability: 'live_chat', keywords: ['ticket', 'kanban'] },
      { to: '/history', labelKey: 'history', icon: History, code: 'history', capability: 'history', keywords: ['transcript', 'archive'] },
      // Customer journey board (PLN-261006 P3) — same holders as live chat.
      { to: '/journey', labelKey: 'journey', icon: Route, code: 'journey', capability: 'live_chat', keywords: ['cjm', 'funnel'] },
    ],
  },
  {
    key: 'insights',
    items: [
      { to: '/statistics', labelKey: 'statistics', icon: BarChart3, code: 'statistics', capability: 'statistics', keywords: ['report', 'analytics', 'csat'] },
      // Audit-backed agent activity — same holders as TENANT_AUDIT_READ.
      { to: '/work-log', labelKey: 'workLog', icon: ClipboardList, code: 'work_log', capability: 'work_log', keywords: ['activity', 'audit'] },
    ],
  },
  {
    key: 'ai',
    items: [
      { to: '/ai-setting', labelKey: 'aiSettings', icon: Bot, code: 'ai_settings', capability: 'ai_settings', keywords: ['agent', 'persona', 'prompt', 'scenario'] },
      { to: '/knowledge', labelKey: 'knowledge', icon: BookOpen, code: 'knowledge', capability: 'knowledge', keywords: ['kb', 'faq', 'document', 'board'] },
      // The synced catalogue that feeds product knowledge — same group as Knowledge.
      { to: '/products', labelKey: 'products', icon: Package, code: 'products', capability: 'knowledge', keywords: ['catalog', 'shopify'] },
    ],
  },
  {
    key: 'commerce',
    items: [
      { to: '/customers', labelKey: 'customers', icon: Users, code: 'customers', capability: 'customers', keywords: ['crm', 'company'] },
      { to: '/orders', labelKey: 'orders', icon: ShoppingCart, code: 'orders', capability: 'orders', keywords: ['shipping', 'delivery'] },
      { to: '/campaigns', labelKey: 'campaigns', icon: Megaphone, code: 'campaigns', capability: 'campaigns', keywords: ['marketing', 'push'] },
      // Review moderation console (D3) — same operations group as the API's MODULE_OPERATIONS gate.
      { to: '/reviews', labelKey: 'reviews', icon: Star, code: 'reviews', capability: 'reviews', keywords: ['rating'] },
    ],
  },
  {
    key: 'workspace',
    items: [
      { to: '/users', labelKey: 'users', icon: UserCog, code: 'users', capability: 'users', keywords: ['team', 'label', 'member', 'invite'] },
      // One entry, seven tabs inside (PLN-260824 D6 revised). The screens are
      // still separate routes and still provisioned one by one, they are just
      // reached by tab. The consent notice moved in with them — it is a setting.
      { to: '/settings', labelKey: 'settings', icon: Settings, code: 'settings', capability: 'settings', keywords: ['widget', 'integration', 'privacy', 'messenger'] },
    ],
  },
];

export const ADMIN_NAV_GROUPS: NavGroup[] = [
  {
    key: 'platform',
    items: [
      { to: '/admin', labelKey: 'overview', icon: ShieldCheck, keywords: ['home'] },
      { to: '/admin/tenants', labelKey: 'tenants', icon: Building2, keywords: ['shop', 'plan'] },
      { to: '/admin/ai-engines', labelKey: 'aiEngines', icon: Cpu, keywords: ['model', 'anthropic', 'openai'] },
    ],
  },
  {
    key: 'security',
    items: [
      // Platform-admin accounts (REQ-260824) — matches the server's super-only gate.
      { to: '/admin/admins', labelKey: 'admins', icon: UserCog, superAdminOnly: true, keywords: ['operator'] },
      { to: '/admin/audit', labelKey: 'audit', icon: ScrollText, keywords: ['log'] },
    ],
  },
];

/** Flat lists — the route guard and the all-menus page read these. */
export const TENANT_NAV: NavItem[] = TENANT_NAV_GROUPS.flatMap((g) => g.items);
export const ADMIN_NAV: NavItem[] = ADMIN_NAV_GROUPS.flatMap((g) => g.items);

/**
 * Settings tabs, so ⌘K can jump straight to "Widget" or "Messengers" — the
 * screens people most often go looking for and the hardest to find by eye.
 */
export const SETTINGS_TABS: Array<{ to: string; labelKey: string; keywords?: string[] }> = [
  { to: '/settings/basic', labelKey: 'settingsBasic', keywords: ['ai engine', 'storefront'] },
  { to: '/settings/handoff', labelKey: 'settingsHandoff', keywords: ['hours', 'assignee'] },
  { to: '/settings/widget', labelKey: 'settingsWidget', keywords: ['embed', 'snippet', 'theme', 'design'] },
  { to: '/settings/platforms', labelKey: 'settingsPlatforms', keywords: ['shopify', 'cafe24', 'odoo'] },
  { to: '/settings/marketing', labelKey: 'settingsMarketing', keywords: ['klaviyo', 'yotpo', 'gorgias'] },
  { to: '/settings/messengers', labelKey: 'settingsMessengers', keywords: ['telegram', 'gmail', 'zalo'] },
  { to: '/settings/etc', labelKey: 'settingsEtc', keywords: ['snapshot', 'other'] },
  { to: '/settings/privacy', labelKey: 'privacyNotice', keywords: ['consent', 'gdpr', 'ccpa'] },
];

/**
 * The nav entry a pathname belongs to (longest prefix wins) and its group —
 * used for the header breadcrumb.
 */
export function findNavEntry(
  pathname: string,
  groups: NavGroup[],
): { group: NavGroup; item: NavItem } | null {
  let best: { group: NavGroup; item: NavItem } | null = null;
  for (const group of groups) {
    for (const item of group.items) {
      const hit =
        pathname === item.to || (item.to !== '/admin' && pathname.startsWith(`${item.to}/`));
      if (hit && (!best || item.to.length > best.item.to.length)) best = { group, item };
    }
  }
  return best;
}
