import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from '@/store/toast-store';
import { useTenantKey } from '@/lib/use-tenant-key';
import { inquiriesService } from './inquiries.service';
import type { InquiryListParams, InquiryStatus } from './inquiries.service';

/** The widget's contact forms (ivy-docs T11 D4) — the alarm center tab and its badge. */
export const useInquiries = (params: InquiryListParams, enabled = true) => {
  const tenantKey = useTenantKey();
  return useQuery({
    queryKey: ['agent', tenantKey, 'inquiries', params],
    queryFn: () => inquiriesService.list(params),
    enabled,
    refetchInterval: 60_000,
  });
};

/** Mark answered / open again — refreshes the tab and its badge. */
export const useSetInquiryStatus = () => {
  const { t } = useTranslation('livechat');
  const qc = useQueryClient();
  const tenantKey = useTenantKey();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: InquiryStatus }) => inquiriesService.setStatus(id, status),
    onSuccess: (_d, { status }) => {
      qc.invalidateQueries({ queryKey: ['agent', tenantKey, 'inquiries'] });
      toast.success(t(status === 'answered' ? 'inquiry.answeredToast' : 'inquiry.reopenedToast'));
    },
    onError: (e: Error) => toast.error(e.message || t('inquiry.updateError'), { sticky: true }),
  });
};
