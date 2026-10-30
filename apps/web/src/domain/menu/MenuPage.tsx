import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowUpRight, UserCircle } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { useAuthStore } from '@/store/auth-store';
import { useVisibleNav } from '@/layouts/use-shell';
import type { NavGroup, NavItem } from '@/layouts/nav-config';

/**
 * Every screen this user can reach, as cards (PLN-260808-Console-Menu-Overview).
 *
 * Reached from the sidebar logo, which until now did nothing — in most consoles
 * a logo goes home, so clicking it and getting nothing reads as broken.
 *
 * The card list is derived from `nav-config`, the same source the sidebar reads,
 * and grouped the same way (REQ-261030) so this page and the sidebar teach one
 * map of the console. Declaring the cards separately would leave this page
 * quietly out of date the first time someone adds a menu item.
 */
export function MenuPage() {
  const { t } = useTranslation(['menu', 'nav']);
  const tenantName = useAuthStore((s) => s.tenantName);
  const tenantSlug = useAuthStore((s) => s.tenantSlug);
  const { isAdmin, groups } = useVisibleNav();

  // My Page lives in the account menu, away from the nav list, which makes it
  // easy to miss entirely. It belongs in a screen called "all menus".
  const account: NavGroup = {
    key: '__account',
    items: [{ to: isAdmin ? '/admin/my-page' : '/my-page', labelKey: 'myPage', icon: UserCircle }],
  };

  return (
    <div>
      <PageHeader
        title={t('menu:title')}
        subtitle={t('menu:subtitle', {
          scope: isAdmin ? t('nav:platformAdmin') : (tenantName ?? tenantSlug ?? 'SharpTalk'),
        })}
      />

      <div className="space-y-8">
        {[...groups, account].map((group) => (
          <section key={group.key} aria-labelledby={`menu-${group.key}`}>
            <h2
              id={`menu-${group.key}`}
              className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-400"
            >
              {group.key === '__account' ? t('nav:myPage') : t(`nav:groups.${group.key}`)}
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {group.items.map((item) => (
                <MenuCard key={item.to} item={item} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

function MenuCard({ item }: { item: NavItem }) {
  const { t } = useTranslation(['menu', 'nav']);
  const Icon = item.icon;
  return (
    <Link
      to={item.to}
      className="group relative flex gap-3 rounded-xl border border-gray-200 bg-white p-5 shadow-card transition-all hover:-translate-y-px hover:border-primary-300 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-600">
        <Icon className="h-5 w-5" aria-hidden />
      </div>
      <div className="min-w-0 pr-4">
        <p className="font-medium text-gray-900 group-hover:text-primary-700">{t(`nav:${item.labelKey}`)}</p>
        {/* Falls back to nothing rather than showing a raw key: a card with
            just its name is still usable. */}
        <p className="mt-1 text-sm text-gray-500">{t(`menu:items.${item.labelKey}`, { defaultValue: '' })}</p>
      </div>
      <ArrowUpRight
        className="absolute right-4 top-4 h-4 w-4 text-gray-300 opacity-0 transition-opacity group-hover:opacity-100"
        aria-hidden
      />
    </Link>
  );
}
