import { useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTenantKey } from '@/lib/use-tenant-key';
import { useAuthStore } from '@/store/auth-store';
import { routingCategoriesService } from './routing-categories.service';

export const useRoutingCategories = () => {
  const tenantKey = useTenantKey();
  // Tenant data: the alarm bell and escalation modal sit in the shared layout,
  // so platform admins used to fire this on every screen and get a 403.
  const isTenantUser = useAuthStore((s) => s.principal?.actorType) === 'user';
  return useQuery({
    queryKey: ['routing-categories', tenantKey],
    queryFn: () => routingCategoriesService.list(),
    enabled: isTenantUser,
  });
};

/** Create / rename+reorder / delete. Toasts are the caller's (the modal names the row). */
export function useRoutingCategoryMutations() {
  const qc = useQueryClient();
  const tenantKey = useTenantKey();
  const refresh = () => qc.invalidateQueries({ queryKey: ['routing-categories', tenantKey] });
  return {
    create: useMutation({ mutationFn: routingCategoriesService.create, onSuccess: refresh }),
    update: useMutation({ mutationFn: routingCategoriesService.update, onSuccess: refresh }),
    remove: useMutation({ mutationFn: routingCategoriesService.remove, onSuccess: refresh }),
  };
}

/** Console display name for a consult category code: the tenant's name, else the code itself. */
export function useCategoryName() {
  const { data } = useRoutingCategories();
  return useCallback((code: string) => data?.find((c) => c.code === code)?.name || code, [data]);
}
