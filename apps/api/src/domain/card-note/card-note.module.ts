import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrderCache } from '../order/entity/order-cache.entity';
import { OrderItem } from '../order/entity/order-item.entity';
import { Fulfillment } from '../order/entity/fulfillment.entity';
import { SessionModule } from '../session/session.module';
import { ModerationModule } from '../moderation/moderation.module';
import { ProductModule } from '../product/product.module';
import { CardNoteController } from './card-note.controller';
import { CardNoteService } from './card-note.service';

/**
 * AI lines next to the chat's data cards (IVY PRD v1 C-02). Its own module so
 * the chat module's imports stay as they are: it reads orders (repositories
 * only) and the product module's stock search, and depends on nothing in Chat.
 */
@Module({
  imports: [TypeOrmModule.forFeature([OrderCache, OrderItem, Fulfillment]), SessionModule, ModerationModule, ProductModule],
  controllers: [CardNoteController],
  providers: [CardNoteService],
})
export class CardNoteModule {}
