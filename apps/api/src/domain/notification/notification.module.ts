import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SessionModule } from '../session/session.module';
import { Notification } from './entity/notification.entity';
import { NotificationPref } from './entity/notification-pref.entity';
import { Session } from '../session/entity/session.entity';
import { Tenant } from '../tenant/entity/tenant.entity';
import { OrderCache } from '../order/entity/order-cache.entity';
import { OrderItem } from '../order/entity/order-item.entity';
import { NotificationService } from './notification.service';
import { NotificationController } from './notification.controller';
import { NotificationPromoService } from './notification-promo.service';
import { Campaign } from '../campaign/entity/campaign.entity';

@Module({
  imports: [
    // Order rows are read (never written) for the feed's order notices (ivy-docs T02 B2).
    // Campaigns are read (never written) for promo kind + coupon code (ivy-docs T05).
    TypeOrmModule.forFeature([Notification, NotificationPref, Session, Tenant, OrderCache, OrderItem, Campaign]),
    SessionModule,
  ],
  controllers: [NotificationController],
  providers: [NotificationService, NotificationPromoService],
  exports: [NotificationService],
})
export class NotificationModule {}
