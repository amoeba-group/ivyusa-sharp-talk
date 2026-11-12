import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Inquiry } from './entity/inquiry.entity';
import { Session } from '../session/entity/session.entity';
import { Conversation } from '../chat/entity/conversation.entity';
import { Tenant } from '../tenant/entity/tenant.entity';
import { SessionModule } from '../session/session.module';
import { CustomerModule } from '../customer/customer.module';
import { ErasureSuppressionModule } from '../privacy/erasure-suppression.module';
import { AuditModule } from '../audit/audit.module';
import { InquiryService } from './inquiry.service';
import { AdminInquiryController, InquiryController } from './inquiry.controller';

/**
 * Inquiries (FR-044, ivy-docs T11). Entity-only reads of session / chat /
 * tenant tables; nothing imports this module back, so no cycle.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([Inquiry, Session, Conversation, Tenant]),
    SessionModule,
    CustomerModule,
    ErasureSuppressionModule,
    AuditModule,
  ],
  controllers: [InquiryController, AdminInquiryController],
  providers: [InquiryService],
  exports: [InquiryService],
})
export class InquiryModule {}
