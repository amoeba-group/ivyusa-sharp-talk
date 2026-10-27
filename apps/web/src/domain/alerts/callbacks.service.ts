import { apiGet, apiGetList, apiPatch } from '@/lib/api-client';

export type CallbackStatus = 'requested' | 'done' | 'canceled';
export type CallbackChannel = 'email' | 'phone';

/** A customer's callback request (PLN-261026 B4–B6) — the contact comes masked. */
export interface CallbackRequest {
  id: string;
  conversationId: string;
  channel: CallbackChannel | string;
  contactSource: 'member' | 'entered' | string;
  contactMasked: string;
  language: string | null;
  status: CallbackStatus | string;
  handledBy: { id: string; name: string } | null;
  handledAt: string | null;
  createdAt: string;
  hotel: string | null;
}

export interface CallbackListParams {
  status?: CallbackStatus | 'all';
  conversation_id?: string;
  page?: number;
  size?: number;
}

export const callbacksService = {
  list: (p: CallbackListParams) => apiGetList<CallbackRequest>('/callback-requests', p),
  /** The plain contact — audited server-side on every call. Keep it in component state only. */
  reveal: (id: string) => apiGet<{ contact: string; channel: string }>(`/callback-requests/${id}/contact`),
  setStatus: (id: string, status: CallbackStatus) => apiPatch<CallbackRequest>(`/callback-requests/${id}`, { status }),
};
