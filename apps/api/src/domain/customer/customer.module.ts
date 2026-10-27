import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Customer } from './entity/customer.entity';
import { OrderCache } from '../order/entity/order-cache.entity';
import { CustomerService } from './customer.service';
import { CustomerController } from './customer.controller';
import { ErasureSuppressionModule } from '../privacy/erasure-suppression.module';
import { AuditModule } from '../audit/audit.module';
import { Conversation } from '../chat/entity/conversation.entity';
import { Session } from '../session/entity/session.entity';
import { Company } from '../company/entity/company.entity';
import { CompanyContact } from '../company/entity/company-contact.entity';
import { CustomerPlatformLink } from './entity/customer-platform-link.entity';
import { CustomerPlatformLinkService } from './customer-platform-link.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Customer, OrderCache, Conversation, Session, Company, CompanyContact, CustomerPlatformLink]),
    ErasureSuppressionModule,
    AuditModule,
  ],
  controllers: [CustomerController],
  providers: [CustomerService, CustomerPlatformLinkService],
  exports: [CustomerService, CustomerPlatformLinkService],
})
export class CustomerModule {}
