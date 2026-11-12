import { apiGet, apiGetList, apiPatch } from '@/lib/api-client';

export type InquiryStatus = 'open' | 'answered';

/** A contact form a shopper sent from the widget (ivy-docs T11) — address masked in the list. */
export interface Inquiry {
  id: string;
  status: InquiryStatus | string;
  createdAt: string;
  language: string | null;
  contactName: string | null;
  contactEmailMasked: string | null;
  messagePreview: string | null;
  conversationId: string | null;
  customerId: string | null;
  orderId: string | null;
}

/** One inquiry in full — every read is audited server-side. */
export interface InquiryDetail extends Inquiry {
  contactEmail: string | null;
  message: string | null;
}

export interface InquiryListParams {
  status?: InquiryStatus | 'all';
  page?: number;
  size?: number;
}

export const inquiriesService = {
  list: (p: InquiryListParams) => apiGetList<Inquiry>('/admin/inquiries', p),
  /** The address and the whole message. Keep it in component state only — never in the query cache. */
  detail: (id: string) => apiGet<InquiryDetail>(`/admin/inquiries/${id}`),
  setStatus: (id: string, status: InquiryStatus) => apiPatch<Inquiry>(`/admin/inquiries/${id}`, { status }),
};
