import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CAPABILITY, Principal } from '@sharptalk/types';
import { InquiryService } from './inquiry.service';
import {
  AdminInquiryListQuery,
  CreateInquiryRequest,
  InquiryListQuery,
  UpdateInquiryStatusRequest,
} from './dto/request/inquiry.request';
import { Public } from '../../global/decorator/public.decorator';
import { RequireCapability } from '../../global/decorator/auth.decorator';
import { CurrentUser } from '../../global/decorator/current-user.decorator';
import { SessionToken } from '../../global/decorator/session-token.decorator';
import { asTenantUser } from '../user/user-principal.util';

/** Widget inquiry endpoints (FR-044). */
@ApiTags('Inquiries')
@Controller('inquiries')
export class InquiryController {
  constructor(private readonly inquiryService: InquiryService) {}

  @Post()
  @Public()
  // Per IP; the service also caps each session at 5 an hour (T11 D3).
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Send the contact form — name, email, message (FR-044, ivy-docs T11)' })
  async create(@Body() body: CreateInquiryRequest) {
    return this.inquiryService.create(body.session_token, {
      name: body.name,
      email: body.email,
      message: body.message,
      conversationId: body.conversation_id ?? null,
      orderId: body.order_id ?? null,
    });
  }

  @Get()
  @Public()
  @ApiOperation({ summary: "List the session customer's inquiries" })
  async list(@SessionToken() token: string, @Query() query: InquiryListQuery) {
    return this.inquiryService.listForSession(token, query.page, query.size);
  }
}

/** Admin inquiry handling — the alarm center's Inquiries tab (ivy-docs T11 D4). */
@ApiTags('Inquiries')
@Controller('admin/inquiries')
export class AdminInquiryController {
  constructor(private readonly inquiryService: InquiryService) {}

  @Get()
  @RequireCapability(CAPABILITY.MODULE_CONSULT)
  @ApiOperation({ summary: 'List inquiries (address masked, message shortened)' })
  async list(@CurrentUser() user: Principal, @Query() query: AdminInquiryListQuery) {
    return this.inquiryService.listAll(asTenantUser(user).tenantId, query.status, query.page, query.size);
  }

  /** The address and the whole message — every read is audited, like a callback contact. */
  @Get(':id')
  @RequireCapability(CAPABILITY.MODULE_CONSULT)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: 'Open one inquiry in full (audited)' })
  async detail(@CurrentUser() user: Principal, @Param('id', ParseIntPipe) id: number) {
    const actor = asTenantUser(user);
    return this.inquiryService.detail(actor.tenantId, id, actor.userId);
  }

  @Patch(':id')
  @RequireCapability(CAPABILITY.MODULE_CONSULT)
  @ApiOperation({ summary: 'Mark an inquiry answered (or open again)' })
  async answer(
    @CurrentUser() user: Principal,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateInquiryStatusRequest,
  ) {
    const actor = asTenantUser(user);
    return this.inquiryService.setStatus(actor.tenantId, id, actor.userId, body?.status);
  }
}
