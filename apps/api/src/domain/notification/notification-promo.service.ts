import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { NOTIFICATION_REF, promoFromContent, type PromoKind } from '@sharptalk/types';
import { Campaign } from '../campaign/entity/campaign.entity';
import { Notification } from './entity/notification.entity';

export interface NotificationPromo {
  kind: PromoKind;
  couponCode: string | null;
}

/**
 * Promo kind + coupon code for campaign notifications (ivy-docs T05 D2).
 *
 * They live on the campaign, not the row: a dispatch writes `ref_type
 * 'campaign'` + the campaign id on every notification it fans out, and the
 * feed reads the pair back here. Both are locked once the campaign is sent
 * (CampaignService), so what a shopper holds never changes under them.
 *
 * One primary-key query per page, and only when the page has campaign rows.
 * A campaign is used only when it belongs to the row's own tenant.
 */
@Injectable()
export class NotificationPromoService {
  constructor(@InjectRepository(Campaign) private readonly campaignRepo: Repository<Campaign>) {}

  /** Row id → promo, for the rows that point at a campaign of their own tenant. */
  async forRows(rows: readonly Notification[]): Promise<Map<string, NotificationPromo>> {
    const out = new Map<string, NotificationPromo>();
    const linked = rows.filter(
      (r) => r.refType === NOTIFICATION_REF.CAMPAIGN && r.refId != null && r.tenantId != null,
    );
    if (linked.length === 0) return out;
    const ids = [...new Set(linked.map((r) => Number(r.refId)))];
    const campaigns = await this.campaignRepo.find({
      where: { id: In(ids) },
      select: { id: true, tenantId: true, content: true },
    });
    const byId = new Map(campaigns.map((c) => [Number(c.id), c]));
    for (const r of linked) {
      const c = byId.get(Number(r.refId));
      if (!c || c.tenantId == null || Number(c.tenantId) !== Number(r.tenantId)) continue;
      out.set(String(r.id), promoFromContent(c.content));
    }
    return out;
  }
}
