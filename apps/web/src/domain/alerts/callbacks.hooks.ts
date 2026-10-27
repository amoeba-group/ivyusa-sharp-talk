import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from '@/store/toast-store';
import { useTenantKey } from '@/lib/use-tenant-key';
import { callbacksService } from './callbacks.service';
import type { CallbackListParams, CallbackStatus } from './callbacks.service';

/** Callback requests of the tenant (PLN-261026 D6) — the alarm center tab and the chat banner. */
export const useCallbackRequests = (params: CallbackListParams, enabled = true) => {
  const tenantKey = useTenantKey();
  return useQuery({
    queryKey: ['agent', tenantKey, 'callbacks', params],
    queryFn: () => callbacksService.list(params),
    enabled,
    refetchInterval: 30_000,
  });
};

/** The open callback of one conversation, for the banner above the thread. */
export const useOpenCallback = (conversationId: string | null) => {
  const q = useCallbackRequests(
    { conversation_id: conversationId ?? undefined, status: 'requested', page: 1, size: 1 },
    !!conversationId,
  );
  return q.data?.items[0] ?? null;
};

const STATUS_TOAST: Record<CallbackStatus, string> = {
  done: 'callback.doneToast',
  canceled: 'callback.canceledToast',
  requested: 'callback.reopenedToast',
};

/** Done / cancel / reopen — refreshes the tab, its badge and the banner. */
export const useSetCallbackStatus = () => {
  const { t } = useTranslation('livechat');
  const qc = useQueryClient();
  const tenantKey = useTenantKey();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: CallbackStatus }) => callbacksService.setStatus(id, status),
    onSuccess: (_d, { status }) => {
      qc.invalidateQueries({ queryKey: ['agent', tenantKey, 'callbacks'] });
      toast.success(t(STATUS_TOAST[status]));
    },
    onError: (e: Error) => toast.error(e.message || t('callback.updateError'), { sticky: true }),
  });
};
