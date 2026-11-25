import { Campaign } from './entity/campaign.entity';

/**
 * A campaign as the service hands it back: the row, plus — when the request
 * named recipients — the addresses that matched no customer, so the console
 * can say so, and the recipients' addresses for the edit form.
 */
export type CampaignWithTargets = Campaign & { targetNotFound?: string[]; targetEmails?: string[] };

/** Map a campaign row to the camelCase response shape. */
export function toCampaignResponse(c: CampaignWithTargets) {
  return {
    id: c.id,
    name: c.name,
    segmentRef: c.segmentRef,
    // null = every customer (IVY PRD v1 N-04).
    targetCount: Array.isArray(c.targetCustomerIds) ? c.targetCustomerIds.length : null,
    ...(c.targetEmails ? { targetEmails: c.targetEmails } : {}),
    ...(c.targetNotFound ? { targetNotFound: c.targetNotFound } : {}),
    content: c.content,
    status: c.status,
    scheduledAt: c.scheduledAt,
    sentAt: c.sentAt,
  };
}
