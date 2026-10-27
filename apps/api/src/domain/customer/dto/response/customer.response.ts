/** Response DTO — camelCase. */
export interface CustomerResponse {
  id: number;
  tenantId: number | null;
  shopifyCustomerId: string | null;
  email: string | null;
  name: string | null;
  /** Omitted from list rows — the list screen has no use for it (PLN-260920). */
  phone?: string | null;
  /** True when name/email/phone above are masked. The console uses this to
   *  decide whether to offer the reveal control, and to label what is shown. */
  masked: boolean;
  tier: string;
  /** b2c | b2b_contact (PLN-261022 stage 2). */
  customerType: string;
  shopifyTier: string | null;
  orders: number;
  totalSpent: number;
  currency: string | null;
  createdAt: Date;
  updatedAt: Date;
  /** First contact = earliest session or conversation of this person (PLN-261027 D10). */
  firstSeenAt?: Date | null;
  conversationCount?: number;
  /** Company this person is a contact of (business contacts). */
  companyName?: string | null;
}

/** One person's detail screen (PLN-261027 D9). Contact details masked unless revealed. */
export interface CustomerDetailResponse {
  customer: CustomerResponse;
  memo: string | null;
  firstSeenAt: Date | null;
  firstConversationAt: Date | null;
  /** Channel of the first conversation (widget, kakao, …). */
  firstChannel: string | null;
  /** Page the first session opened on (scheme + host + path; no query string). */
  firstLandingPath: string | null;
  companies: Array<{ id: string; name: string | null }>;
  conversations: Array<{
    id: string;
    sessionId: string;
    status: string;
    channel: string;
    createdAt: Date;
    endedAt: Date | null;
  }>;
  /** Platform accounts this person is known by (PLN-261027 D12). */
  platforms: Array<{
    provider: string;
    externalId: string;
    displayName: string | null;
    firstSeenAt: Date;
    lastSeenAt: Date;
  }>;
}
