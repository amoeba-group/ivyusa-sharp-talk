import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ordersService } from './orders.service';
import type { OrderListParams } from './orders.service';
import { useTenantKey } from '@/lib/use-tenant-key';

export const useOrders = (params: OrderListParams) => {
  const tenantKey = useTenantKey();
  return useQuery({
    queryKey: ['orders', tenantKey, params],
    queryFn: () => ordersService.list(params),
    placeholderData: keepPreviousData,
  });
};

/** Fetch one order from the store; the list re-reads so a fetched order shows up. */
export const useLookupOrder = () => {
  const qc = useQueryClient();
  const tenantKey = useTenantKey();
  return useMutation({
    mutationFn: (orderNumber: string) => ordersService.lookup(orderNumber),
    onSuccess: (res) => {
      if (res.found > 0) qc.invalidateQueries({ queryKey: ['orders', tenantKey] });
    },
  });
};
