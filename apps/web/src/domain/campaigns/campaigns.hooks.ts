import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { campaignsService } from './campaigns.service';
import type { CampaignContent } from './campaigns.service';
import { toast } from '@/store/toast-store';
import { useTenantKey } from '@/lib/use-tenant-key';

/**
 * The promo errors in the console's language (ivy-docs T05): the API answers
 * in English and the client localizes by code (CLAUDE.md §2).
 */
const PROMO_ERROR_KEYS: Record<string, string> = {
  E5158: 'errorPromoInvalid',
  E5159: 'errorPromoLocked',
};
function errorText(t: (k: string) => string, err: Error): string {
  const key = PROMO_ERROR_KEYS[(err as Error & { code?: string }).code ?? ''];
  return key ? t(key) : err.message;
}

export function useCampaigns() {
  const tenantKey = useTenantKey();
  return useQuery({
    queryKey: ['campaigns', tenantKey],
    queryFn: () => campaignsService.list(),
  });
}

export function useCreateCampaign() {
  const qc = useQueryClient();
  const tenantKey = useTenantKey();
  const { t } = useTranslation('campaigns');
  return useMutation({
    mutationFn: (body: { name: string; content: CampaignContent }) =>
      campaignsService.create(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['campaigns', tenantKey] });
      toast.success(t('toastCreated'));
    },
    onError: (err: Error) => toast.error(errorText(t, err)),
  });
}

export function useUpdateCampaign() {
  const qc = useQueryClient();
  const tenantKey = useTenantKey();
  const { t } = useTranslation('campaigns');
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string; name?: string; content?: CampaignContent }) =>
      campaignsService.update(id, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['campaigns', tenantKey] });
      toast.success(t('toastUpdated'));
    },
    onError: (err: Error) => toast.error(errorText(t, err)),
  });
}

export function useSendCampaign() {
  const qc = useQueryClient();
  const tenantKey = useTenantKey();
  const { t } = useTranslation('campaigns');
  return useMutation({
    mutationFn: (id: string) => campaignsService.send(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['campaigns', tenantKey] });
      toast.success(t('toastSent'));
    },
    // Send-time link validation failures (unknown handle / non-https URL)
    // surface the API 400 message here as a sticky error toast.
    onError: (err: Error) => toast.error(errorText(t, err)),
  });
}
