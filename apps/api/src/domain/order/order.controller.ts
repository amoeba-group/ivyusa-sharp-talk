import { Body, Controller, Get, HttpStatus, Param, ParseIntPipe, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CAPABILITY, Principal } from '@sharptalk/types';
import { OrderService } from './order.service';
import {
  AdminOrderListQuery,
  AdminOrderLookupRequest,
  GuestLookupRequest,
  OrderListQuery,
} from './dto/request/order.request';
import { AuditService } from '../audit/audit.service';
import { Public } from '../../global/decorator/public.decorator';
import { RequireCapability } from '../../global/decorator/auth.decorator';
import { CurrentUser } from '../../global/decorator/current-user.decorator';
import { BusinessException } from '../../global/exception/business.exception';
import { ERROR_CODE } from '../../global/constant/error-code.constant';
import { OrderAddressService } from './order-address.service';
import { SessionToken } from '../../global/decorator/session-token.decorator';

/** Widget + admin order endpoints (FR-019/020/021). */
@ApiTags('Orders')
@Controller('orders')
export class OrderController {
  constructor(
    private readonly orderService: OrderService,
    private readonly orderAddressService: OrderAddressService,
  ) {}

  @Post('guest-lookup')
  @Public()
  @ApiOperation({ summary: 'Guest order lookup; binds session on success (FR-019)' })
  async guestLookup(@Body() body: GuestLookupRequest) {
    return this.orderService.guestLookup(body.session_token, body.order_number, body.email);
  }

  @Get()
  @Public()
  @ApiOperation({ summary: "List the session customer's orders (FR-020)" })
  async list(@SessionToken() token: string, @Query() query: OrderListQuery) {
    return this.orderService.listForSession(token, query.page, query.size, query.days);
  }

  // Declared before ':id' — otherwise ParseIntPipe claims "review-items" and 400s.
  @Get('review-items')
  @Public()
  @ApiOperation({ summary: "Delivered lines the session customer can review (PLN-260923 P3)" })
  async reviewItems(@SessionToken() token: string) {
    return this.orderService.reviewItemsForSession(token);
  }

  @Get(':id')
  @Public()
  @ApiOperation({ summary: 'Order detail with line items (FR-020)' })
  async detail(@Param('id', ParseIntPipe) id: number, @SessionToken() token: string) {
    return this.orderService.detailForSession(token, id);
  }

  @Get(':id/tracking')
  @Public()
  @ApiOperation({ summary: 'Latest fulfillment + delivery stepper (FR-031)' })
  async tracking(@Param('id', ParseIntPipe) id: number, @SessionToken() token: string) {
    return this.orderService.trackingForSession(token, id);
  }

  @Get(':id/addresses')
  @Public()
  @ApiOperation({
    summary: 'Billing + shipping address, read live from the store and never stored (ivy-docs T04)',
  })
  async addresses(@Param('id', ParseIntPipe) id: number, @SessionToken() token: string) {
    return this.orderAddressService.addressesForSession(token, id);
  }
}

/** Admin order list (operations module). */
@ApiTags('Orders')
@Controller('admin/orders')
export class AdminOrderController {
  constructor(
    private readonly orderService: OrderService,
    private readonly auditService: AuditService,
  ) {}

  @Get()
  @RequireCapability(CAPABILITY.MODULE_OPERATIONS)
  @ApiOperation({ summary: 'List all orders (admin), optionally by order number' })
  async list(@CurrentUser() user: Principal, @Query() query: AdminOrderListQuery) {
    return this.orderService.listAll(this.tenantId(user), query.page, query.size, query.q);
  }

  /**
   * Fetch one order from the store when the console's search did not find it
   * (PLN-261117 B3). It pulls a customer's order — personal data — into this
   * system on an operator's say-so, so it is audited.
   */
  @Post('lookup')
  @RequireCapability(CAPABILITY.MODULE_OPERATIONS)
  @ApiOperation({ summary: 'Fetch one order from the store by its number and cache it' })
  async lookup(@CurrentUser() user: Principal, @Body() body: AdminOrderLookupRequest) {
    if (user.actorType !== 'user') {
      throw new BusinessException(ERROR_CODE.FORBIDDEN, HttpStatus.FORBIDDEN);
    }
    const tenantId = user.tenantId;
    const result = await this.orderService.lookupFromStore(tenantId, body.order_number);
    await this.auditService.write({
      tenantId,
      actorType: 'user',
      actorId: user.userId,
      action: 'order.store_lookup',
      target: `order_number:${body.order_number.replace(/^#/, '')}`,
      metadata: { found: result.found },
    });
    return result;
  }

  private tenantId(user: Principal): number {
    if (user.actorType !== 'user') {
      throw new BusinessException(ERROR_CODE.FORBIDDEN, HttpStatus.FORBIDDEN);
    }
    return user.tenantId;
  }
}
