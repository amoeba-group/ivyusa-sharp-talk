import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SessionModule } from '../session/session.module';
import { ModerationModule } from '../moderation/moderation.module';
import { Review } from './entity/review.entity';
import { Session } from '../session/entity/session.entity';
import { OrderItem } from '../order/entity/order-item.entity';
import { OrderCache } from '../order/entity/order-cache.entity';
import { Fulfillment } from '../order/entity/fulfillment.entity';
import { Tenant } from '../tenant/entity/tenant.entity';
import { NotificationModule } from '../notification/notification.module';
import { ReviewService } from './review.service';
import { ReviewRequestService } from './review-request.service';
import { ReviewController } from './review.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Review, Session, OrderItem, OrderCache, Fulfillment, Tenant]),
    SessionModule,
    // D2 — review bodies pass the same non-bypassable moderation gate (FR-069).
    ModerationModule,
    // Review requests after delivery skip customers who refused marketing (IVY PRD v1 N-05).
    NotificationModule,
  ],
  controllers: [ReviewController],
  providers: [ReviewService, ReviewRequestService],
  exports: [ReviewService],
})
export class ReviewModule {}
