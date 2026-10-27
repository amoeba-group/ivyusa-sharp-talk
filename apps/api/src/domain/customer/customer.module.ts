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

@Module({
  imports: [
    TypeOrmModule.forFeature([Customer, OrderCache, Conversation, Session, Company, CompanyContact]),
    ErasureSuppressionModule,
    AuditModule,
  ],
  controllers: [CustomerController],
  providers: [CustomerService],
  exports: [CustomerService],
})
export class CustomerModule {}
