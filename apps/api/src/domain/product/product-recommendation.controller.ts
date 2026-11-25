import { Body, Controller, Get, Put, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CAPABILITY, Principal } from '@sharptalk/types';
import { asTenantUser } from '../user/user-principal.util';
import { RequireCapability } from '../../global/decorator/auth.decorator';
import { CurrentUser } from '../../global/decorator/current-user.decorator';
import { ProductRecommendationService } from './product-recommendation.service';
import {
  PreviewRecommendationQuery,
  SaveRecommendationRequest,
  SearchRecommendationProductsQuery,
} from './dto/request/product-recommendation.request';

/**
 * Recommended products in the console's AI Settings (IVY PRD v1 A-01…A-04,
 * slide 18). Same capability as the rest of AI Settings.
 */
@ApiTags('Product')
@Controller('admin/recommended-products')
export class ProductRecommendationAdminController {
  constructor(private readonly service: ProductRecommendationService) {}

  @Get()
  @RequireCapability(CAPABILITY.AI_SETTINGS_MANAGE)
  @ApiOperation({ summary: 'Categories, saved settings, the picked products and recent changes' })
  async view(@CurrentUser() user: Principal) {
    return this.service.adminView(asTenantUser(user).tenantId);
  }

  @Put()
  @RequireCapability(CAPABILITY.AI_SETTINGS_MANAGE)
  @ApiOperation({ summary: 'Save the mode, products and period of one category × type' })
  async save(@CurrentUser() user: Principal, @Body() body: SaveRecommendationRequest) {
    const u = asTenantUser(user);
    return this.service.save(u.tenantId, Number(u.userId), {
      categoryHandle: body.category_handle,
      recType: body.rec_type,
      mode: body.mode,
      productHandles: body.product_handles ?? [],
      startsAt: body.starts_at ?? null,
      endsAt: body.ends_at ?? null,
    });
  }

  // Static routes; no path parameter in this controller, so no shadowing.
  @Get('search')
  @RequireCapability(CAPABILITY.AI_SETTINGS_MANAGE)
  @ApiOperation({ summary: 'Search the store for products to pick' })
  async search(@CurrentUser() user: Principal, @Query() query: SearchRecommendationProductsQuery) {
    return this.service.search(asTenantUser(user).tenantId, query.q);
  }

  @Get('preview')
  @RequireCapability(CAPABILITY.AI_SETTINGS_MANAGE)
  @ApiOperation({ summary: 'What a shopper sees right now for one category × type' })
  async preview(@CurrentUser() user: Principal, @Query() query: PreviewRecommendationQuery) {
    return this.service.preview(asTenantUser(user).tenantId, query.category, query.type);
  }
}
