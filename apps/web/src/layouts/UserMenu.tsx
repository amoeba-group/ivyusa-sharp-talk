import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, LayoutGrid, LogOut, UserCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/store/auth-store';
import { useMyProfile } from '@/domain/my-page/profile.hooks';
import { StaffAvatar } from '@/components/StaffAvatar';
import { Badge } from '@/components/Badge';
import { useDismiss } from '@/lib/use-dismiss';
import { ThemeSegmented } from './ThemeMenu';
import { useLogout } from './use-shell';

/** Header account menu: identity, My Page, all menus, theme, sign out. */
export function UserMenu() {
  const { t } = useTranslation('nav');
  const principal = useAuthStore((s) => s.principal);
  const isAdmin = principal?.actorType === 'admin';
  const { data: myProfile } = useMyProfile();
  const logout = useLogout();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useDismiss(ref, open, () => setOpen(false));

  const name = myProfile?.displayName || principal?.email || '';
  const role = isAdmin ? 'admin' : principal?.rank ?? 'user';

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t('userMenu.open')}
        className="flex items-center gap-2 rounded-lg py-1 pl-1 pr-1.5 transition-colors hover:bg-gray-100 sm:pr-2"
      >
        <StaffAvatar avatar={isAdmin ? null : myProfile?.avatar} className="h-8 w-8" />
        <span className="hidden max-w-[140px] truncate text-sm font-medium text-gray-700 md:block">{name}</span>
        <ChevronDown className="hidden h-4 w-4 text-gray-400 md:block" aria-hidden />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-12 z-40 w-72 animate-st-pop-in rounded-xl border border-gray-200 bg-surface-elevated shadow-pop"
        >
          <div className="flex items-center gap-3 border-b border-gray-100 p-4">
            <StaffAvatar avatar={isAdmin ? null : myProfile?.avatar} className="h-10 w-10" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-gray-900">{name}</p>
              {principal?.email && name !== principal.email && (
                <p className="truncate text-xs text-gray-500">{principal.email}</p>
              )}
              <div className="mt-1">
                <Badge tone={isAdmin ? 'primary' : 'info'}>{role}</Badge>
              </div>
            </div>
          </div>
          <div className="p-1.5">
            <Link
              to={isAdmin ? '/admin/my-page' : '/my-page'}
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-gray-700 hover:bg-gray-100"
            >
              <UserCircle className="h-4 w-4 text-gray-400" aria-hidden />
              {t('myPage')}
            </Link>
            <Link
              to={isAdmin ? '/admin/menu' : '/menu'}
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-gray-700 hover:bg-gray-100"
            >
              <LayoutGrid className="h-4 w-4 text-gray-400" aria-hidden />
              {t('allMenus')}
            </Link>
          </div>
          <div className="border-t border-gray-100 px-3 py-3">
            <p className="mb-2 text-xs font-medium text-gray-500">{t('theme.label')}</p>
            <ThemeSegmented />
          </div>
          <div className="border-t border-gray-100 p-1.5">
            <button
              type="button"
              role="menuitem"
              onClick={logout}
              className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm text-red-600 hover:bg-red-50"
            >
              <LogOut className="h-4 w-4" aria-hidden />
              {t('logout')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
