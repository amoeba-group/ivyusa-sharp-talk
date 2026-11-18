import { Module } from '@nestjs/common';
import { ShopifyProxyController } from './shopify-proxy.controller';
import { ShopifyProxyService } from './shopify-proxy.service';
import { SessionModule } from '../session/session.module';
import { CustomerModule } from '../customer/customer.module';
import { TenantModule } from '../tenant/tenant.module';
import { OrderModule } from '../order/order.module';
import { ShopifyAdminClient } from '../order/shopify-admin.client';
import { EmbedModule } from '../embed/embed.module';

/** Shopify App Proxy identity bridge (storefront logged-in customer → session). */
@Module({
  // OrderModule supplies ShopifySyncService for the login-time order backfill.
  // EmbedModule: this module registers the Shopify resolver for signed identify
  // (PLN-261118-IVY-Signed-Shopify-Identity). One-way — Embed imports nothing from here.
  imports: [SessionModule, CustomerModule, TenantModule, OrderModule, EmbedModule],
  controllers: [ShopifyProxyController],
  // ShopifyAdminClient is a stateless (dependency-free) fetch wrapper, provided
  // directly for the customer-profile backfill.
  providers: [ShopifyProxyService, ShopifyAdminClient],
})
export class ShopifyProxyModule {}
