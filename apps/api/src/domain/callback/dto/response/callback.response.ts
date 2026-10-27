/** Response shapes — camelCase. Contacts are masked; the plain value comes only from the audited reveal. */
export interface CallbackRequestResponse {
  id: string;
  conversationId: string;
  channel: string;
  contactSource: string;
  contactMasked: string;
  language: string | null;
  status: string;
  handledBy: { id: string; name: string } | null;
  handledAt: Date | null;
  createdAt: Date;
  /** Hotel / region the host signed for the session, when present. */
  hotel: string | null;
}

/** What the widget's callback card shows (B6): masked member contacts only. */
export interface CallbackOptionsResponse {
  enabled: boolean;
  channels: string[];
  member: Array<{ channel: string; masked: string }>;
}

export interface CallbackCreatedResponse {
  id: string;
  channel: string;
  contactMasked: string;
  body: string;
}
