import { apiClient } from '../lib/api-client';
import type { InquiryCreated } from '../lib/types';

/**
 * The contact form (ivy-docs T11 D3). The API mails the tenant's support
 * address and lists it in the console; the shopper is answered by email.
 * `conversationId` links it to this chat when there is one.
 */
export function sendInquiry(
  sessionToken: string,
  form: { name: string; email: string; message: string },
  conversationId?: string | null,
  /**
   * `orderId`: the shopper's order the form is about (IVY PRD v1 E-01) — the
   * API attaches it only when the order is theirs. `kind: 'feedback'`: the
   * Feedback quick menu, kept for the admin and not mailed (C-01).
   */
  opts: { orderId?: string | null; kind?: 'feedback' } = {},
): Promise<InquiryCreated> {
  return apiClient.post<InquiryCreated>('/inquiries', {
    session_token: sessionToken,
    name: form.name,
    email: form.email,
    message: form.message,
    ...(conversationId ? { conversation_id: conversationId } : {}),
    ...(opts.orderId ? { order_id: opts.orderId } : {}),
    ...(opts.kind ? { kind: opts.kind } : {}),
  });
}
