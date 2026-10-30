import { useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { ChevronsLeft, ChevronsRight, Sparkles, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/store/auth-store';
import { useUiStore } from '@/store/ui-store';
import { cn } from '@/lib/cn';
import { useVisibleNav } from './use-shell';

/** Brand block: the logo opens the all-menus overview (a logo that does nothing reads as broken). */
function Brand({ collapsed, onNavigate }: { collapsed: boolean; onNavigate?: () => void }) {
  const { t } = useTranslation('nav');
  const tenantName = useAuthStore((s) => s.tenantName);
  const tenantSlug = useAuthStore((s) => s.tenantSlug);
  const isAdmin = useAuthStore((s) => s.principal?.actorType) === 'admin';
  return (
    <NavLink
      to={isAdmin ? '/admin/menu' : '/menu'}
      onClick={onNavigate}
      aria-label={t('allMenus')}
      title={t('allMenus')}
      className={cn(
        'flex h-16 shrink-0 items-center gap-3 px-4 transition-colors hover:bg-gray-50',
        collapsed && 'justify-center px-0',
      )}
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary-500 to-violet-500 text-white shadow-sm">
        <Sparkles className="h-[18px] w-[18px]" aria-hidden />
      </span>
      {!collapsed && (
        <span className="min-w-0 leading-tight">
          {/* Tenant-first: shop name on top, brand underneath, smaller. */}
          <span className="block truncate text-sm font-semibold text-gray-900">
            {isAdmin ? 'SharpTalk' : tenantName ?? tenantSlug ?? 'SharpTalk'}
          </span>
          <span className="block truncate text-xs text-gray-400">
            {isAdmin ? t('platformAdmin') : 'SharpTalk'}
          </span>
        </span>
      )}
    </NavLink>
  );
}

function NavList({ collapsed, onNavigate }: { collapsed: boolean; onNavigate?: () => void }) {
  const { t } = useTranslation('nav');
  const { groups } = useVisibleNav();

  return (
    <nav className="flex-1 overflow-y-auto px-3 pb-4 pt-1" aria-label={t('console')}>
      {groups.map((group, gi) => (
        <div key={group.key} className={cn(gi > 0 && 'mt-3')}>
          {collapsed ? (
            gi > 0 && <div className="mx-2 mb-3 border-t border-gray-100" aria-hidden />
          ) : (
            <p className="px-2.5 pb-1 pt-1 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
              {t(`groups.${group.key}`)}
            </p>
          )}
          <ul className="space-y-0.5">
            {group.items.map((item) => {
              const Icon = item.icon;
              const label = t(item.labelKey);
              return (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end={item.to === '/admin'}
                    onClick={onNavigate}
                    title={collapsed ? label : undefined}
                    aria-label={collapsed ? label : undefined}
                    className={({ isActive }) =>
                      cn(
                        'group relative flex items-center gap-3 rounded-lg px-2.5 py-[7px] text-[13px] font-medium transition-colors',
                        isActive
                          ? 'bg-primary-50 text-primary-700'
                          : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900',
                        collapsed && 'justify-center px-0',
                      )
                    }
                  >
                    {({ isActive }) => (
                      <>
                        {isActive && (
                          <span
                            className="absolute -left-3 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-primary-500"
                            aria-hidden
                          />
                        )}
                        <Icon
                          className={cn(
                            'h-[18px] w-[18px] shrink-0',
                            isActive ? 'text-primary-600' : 'text-gray-400 group-hover:text-gray-600',
                          )}
                          aria-hidden
                        />
                        {!collapsed && <span className="truncate">{label}</span>}
                      </>
                    )}
                  </NavLink>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

/** Desktop rail (lg and up): full width or icon-only, remembered. */
export function Sidebar() {
  const { t } = useTranslation('nav');
  const collapsed = useUiStore((s) => s.sidebarCollapsed);
  const toggle = useUiStore((s) => s.toggleSidebar);

  return (
    <aside
      className={cn(
        'fixed inset-y-0 left-0 z-30 hidden flex-col border-r border-gray-200 bg-surface-sidebar transition-[width] duration-200 lg:flex',
        collapsed ? 'w-[72px]' : 'w-[248px]',
      )}
    >
      <Brand collapsed={collapsed} />
      <NavList collapsed={collapsed} />
      <div className="border-t border-gray-100 p-3">
        <button
          type="button"
          onClick={toggle}
          aria-label={collapsed ? t('sidebar.expand') : t('sidebar.collapse')}
          title={collapsed ? t('sidebar.expand') : t('sidebar.collapse')}
          className={cn(
            'flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-[13px] font-medium text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-800',
            collapsed && 'justify-center px-0',
          )}
        >
          {collapsed ? (
            <ChevronsRight className="h-[18px] w-[18px]" aria-hidden />
          ) : (
            <>
              <ChevronsLeft className="h-[18px] w-[18px]" aria-hidden />
              <span>{t('sidebar.collapse')}</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
}

/** Below lg: the same navigation as a drawer, opened from the header. */
export function MobileNav() {
  const { t } = useTranslation('nav');
  const open = useUiStore((s) => s.mobileNavOpen);
  const setOpen = useUiStore((s) => s.setMobileNavOpen);
  const { pathname } = useLocation();

  // Navigating closes the drawer.
  useEffect(() => {
    setOpen(false);
  }, [pathname, setOpen]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, setOpen]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label={t('console')}>
      <div className="absolute inset-0 animate-st-fade-in bg-gray-950/50 backdrop-blur-[2px]" onClick={() => setOpen(false)} />
      <aside className="relative flex h-full w-[280px] max-w-[85vw] animate-st-slide-in flex-col bg-surface-sidebar shadow-pop">
        <div className="flex items-center">
          <div className="min-w-0 flex-1">
            <Brand collapsed={false} onNavigate={() => setOpen(false)} />
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label={t('sidebar.closeMenu')}
            className="mr-3 rounded-lg p-2 text-gray-500 hover:bg-gray-100"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>
        <NavList collapsed={false} onNavigate={() => setOpen(false)} />
      </aside>
    </div>
  );
}
