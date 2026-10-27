import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CallbackRequest } from './entity/callback-request.entity';
import { CallbackService } from './callback.service';
import { CallbackController } from './callback.controller';
import { Conversation } from '../chat/entity/conversation.entity';
import { Message } from '../chat/entity/message.entity';
import { Session } from '../session/entity/session.entity';
import { Customer } from '../customer/entity/customer.entity';
import { AgentAlert } from '../agent/entity/agent-alert.entity';
import { User } from '../user/entity/user.entity';
import { AiEngineModule } from '../ai-engine/ai-engine.module';
import { SessionModule } from '../session/session.module';
import { ErasureSuppressionModule } from '../privacy/erasure-suppression.module';
import { AuditModule } from '../audit/audit.module';

/**
 * Callback requests (PLN-261026). Entity-only reads of chat/agent/customer
 * tables, so it depends on no other domain module's providers but the ones
 * imported here — no cycle with Chat or Agent.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([CallbackRequest, Conversation, Message, Session, Customer, AgentAlert, User]),
    AiEngineModule,
    SessionModule,
    ErasureSuppressionModule,
    AuditModule,
  ],
  controllers: [CallbackController],
  providers: [CallbackService],
})
export class CallbackModule {}
