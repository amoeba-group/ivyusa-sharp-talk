import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { dashboardService } from './dashboard.service';
import { statisticsService } from '@/domain/statistics/statistics.service';
import { useTenantKey } from '@/lib/use-tenant-key';

export const useDashboard = () => {
  const tenantKey = useTenantKey();
  return useQuery({ queryKey: ['dashboard', tenantKey], queryFn: dashboardService.dashboard });
};

export const useIntegrationStatus = () => {
  const tenantKey = useTenantKey();
  return useQuery({
    queryKey: ['integrations', tenantKey, 'status'],
    queryFn: dashboardService.integrations,
  });
};

export const useRecentOrders = () => {
  const tenantKey = useTenantKey();
  return useQuery({
    queryKey: ['dashboard', tenantKey, 'recent-orders'],
    queryFn: dashboardService.recentOrders,
    // Needs the operations capability; don't retry on RBAC/errors on the dashboard.
    retry: false,
  });
};

/**
 * Widget traffic + nested journey for the dashboard's activity section. Both
 * are statistics endpoints — a role without Statistics gets a 403, which the
 * page turns into a sentence rather than a retry loop.
 */
export const useDashboardActivity = (from: string, to: string) => {
  const tenantKey = useTenantKey();
  const access = useQuery({
    queryKey: ['dashboard', tenantKey, 'access', from, to],
    queryFn: () => statisticsService.access(from, to),
    placeholderData: keepPreviousData,
    retry: false,
  });
  const journey = useQuery({
    queryKey: ['dashboard', tenantKey, 'journey', from, to],
    queryFn: () => statisticsService.journey(from, to),
    placeholderData: keepPreviousData,
    retry: false,
  });
  return { access, journey };
};
