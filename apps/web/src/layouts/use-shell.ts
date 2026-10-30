import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/auth-store';
import { tenantLoginPath } from '@/lib/tenant-path';
import { authService } from '@/domain/auth/auth.service';
import { useMenuAccess } from '@/lib/use-menu-access';
import {
  ADMIN_NAV_GROUPS,
  TENANT_NAV_GROUPS,
  type NavGroup,
} from './nav-config';

/** Sign out: best-effort server revocation, then local state and the right login page. */
export function useLogout() {
  const navigate = useNavigate();
  const clear = useAuthStore((s) => s.clear);
  return useCallback(() => {
    // Best-effort server-side revocation of the (in-memory) refresh token;
    // local state is cleared regardless.
    const { refreshToken, tenantSlug: slug, principal } = useAuthStore.getState();
    const isAdmin = principal?.actorType === 'admin';
    void authService.logout(refreshToken ?? undefined).catch(() => undefined);
    const target = isAdmin ? '/admin/login' : slug ? tenantLoginPath(slug) : '/';
    clear();
    navigate(target);
  }, [clear, navigate]);
}

/**
 * The nav this user may see, grouped. Sidebar, mobile drawer, breadcrumb and
 * ⌘K all read it here so they can never disagree about what exists.
 */
export function useVisibleNav(): { isAdmin: boolean; groups: NavGroup[] } {
  const principal = useAuthStore((s) => s.principal);
  const isAdmin = principal?.actorType === 'admin';
  const { canSeeMenu } = useMenuAccess();
  const source = isAdmin ? ADMIN_NAV_GROUPS : TENANT_NAV_GROUPS;
  const groups = source
    .map((g) => ({
      ...g,
      items: g.items.filter((i) =>
        isAdmin
          ? !i.superAdminOnly || principal?.level === 'super_admin'
          : canSeeMenu(i.code, i.capability),
      ),
    }))
    .filter((g) => g.items.length > 0);
  return { isAdmin, groups };
}
