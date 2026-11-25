import { apiGet, apiPatch, apiPost } from '@/lib/api-client';

/**
 * Deep-link carried in campaign content (PLN-260807 F4, A-9).
 * product: `handle` is validated against the tenant catalog at send time.
 * url: must be https:// (validated at send time).
 */
export interface CampaignLink {
  type: 'product' | 'url';
  handle?: string;
  url?: string;
}

/** Campaign content JSON — message/channel plus the optional deep-link. */
export interface CampaignContent {
  message?: string;
  channel?: string;
  link?: CampaignLink;
  /** Promo kind (ivy-docs T05): event (default) or coupon. Locked once sent. */
  kind?: 'event' | 'coupon';
  /** A coupon's shared code, 1–32 of [A-Za-z0-9_-]. Locked once sent. */
  couponCode?: string;
  [key: string]: unknown;
}

export interface Campaign {
  id: string;
  name: string;
  channel?: string;
  status?: string;
  audienceSize?: number;
  sentCount?: number;
  createdAt?: string;
  /** Set the first time the campaign is sent; kind + coupon code lock from then on. */
  sentAt?: string | null;
  content?: CampaignContent | null;
  /** How many customers it goes to; null = every customer (IVY PRD v1 N-04). */
  targetCount?: number | null;
  /** The chosen customers' addresses, for the edit form. */
  targetEmails?: string[];
  /** Only on a save that named recipients: addresses that matched no customer. */
  targetNotFound?: string[];
}

/** What a save sends. `target_emails`: null = every customer, a list = those customers. */
export interface CampaignWrite {
  name?: string;
  content?: CampaignContent;
  target_emails?: string[] | null;
}

export const campaignsService = {
  list: () => apiGet<Campaign[]>('/campaigns'),
  create: (body: CampaignWrite & { name: string }) => apiPost<Campaign>('/campaigns', body),
  update: (id: string, body: CampaignWrite) => apiPatch<Campaign>(`/campaigns/${id}`, body),
  send: (id: string) => apiPost<Campaign>(`/campaigns/${id}/send`),
};
