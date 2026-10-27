import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CAPABILITY, Principal } from '@sharptalk/types';
import { buildPagination, normalizePage } from '@sharptalk/common';
import { CallbackService } from './callback.service';
import { CreateCallbackRequest, ListCallbacksQuery, UpdateCallbackStatusRequest } from './dto/request/callback.request';
import { SessionService } from '../session/session.service';
import { asTenantUser } from '../user/user-principal.util';
import { Public } from '../../global/decorator/public.decorator';
import { SessionToken } from '../../global/decorator/session-token.decorator';
import { RequireCapability } from '../../global/decorator/auth.decorator';
import { CurrentUser } from '../../global/decorator/current-user.decorator';
import { Paginated } from '../../global/interceptor/transform.interceptor';

/** Callback requests (PLN-261026 B4–B6): the widget files them, the console works them. */
@ApiTags('Callback')
@Controller()
export class CallbackController {
  constructor(
    private readonly service: CallbackService,
    private readonly sessions: SessionService,
  ) {}

  @Get('callback/options')
  @Public()
  @ApiOperation({ summary: "Callback on/off, contact kinds and the member's contacts (masked)" })
  async options(@SessionToken() token: string) {
    return this.service.options(await this.sessions.findByToken(token));
  }

  @Post('callback')
  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Request a callback with a member or entered contact' })
  async create(@Body() body: CreateCallbackRequest) {
    const session = await this.sessions.findByToken(body.session_token);
    return this.service.create(session, {
      conversationId: body.conversation_id,
      source: body.source,
      channel: body.channel,
      contact: body.contact,
    });
  }

  @Get('callback-requests')
  @RequireCapability(CAPABILITY.CONVERSATION_HANDLE)
  @ApiOperation({ summary: 'Callback requests of the tenant (contacts masked)' })
  async list(@CurrentUser() user: Principal, @Query() query: ListCallbacksQuery) {
    const { page, size } = normalizePage(query.page, query.size ?? '20');
    const { items, total } = await this.service.list(
      asTenantUser(user).tenantId,
      { status: query.status, conversationId: query.conversation_id },
      page,
      size,
    );
    return new Paginated(items, buildPagination(page, size, total));
  }

  /**
   * The plain contact for the agent about to call back. Same holders as the
   * list — the shopper left it so that an agent would use it — but every
   * read is audited and rate-limited like the customer reveal.
   */
  @Get('callback-requests/:id/contact')
  @RequireCapability(CAPABILITY.CONVERSATION_HANDLE)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: 'Reveal one callback contact (audited)' })
  reveal(@CurrentUser() user: Principal, @Param('id', ParseIntPipe) id: number) {
    const actor = asTenantUser(user);
    return this.service.reveal(actor.tenantId, id, actor.userId);
  }

  @Patch('callback-requests/:id')
  @RequireCapability(CAPABILITY.CONVERSATION_HANDLE)
  @ApiOperation({ summary: 'Mark a callback done / canceled / requested again' })
  update(
    @CurrentUser() user: Principal,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateCallbackStatusRequest,
  ) {
    const actor = asTenantUser(user);
    return this.service.updateStatus(actor.tenantId, id, actor.userId, body.status);
  }
}
