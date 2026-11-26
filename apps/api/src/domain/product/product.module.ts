import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductCache } from './entity/product-cache.entity';
import { ProductSave } from '../save/entity/product-save.entity';
import { Tenant } from '../tenant/entity/tenant.entity';
import { IntegrationCredential } from '../tenant/entity/integration-credential.entity';
import { KbDocument } from '../knowledge/entity/kb-document.entity';
import { Company } from '../company/entity/company.entity';
import { ProductService } from './product.service';
import { ProductSyncService } from './product-sync.service';
import { ProductAdminController, ProductController } from './product.controller';
import { SessionModule } from '../session/session.module';
import { TenantModule } from '../tenant/tenant.module';
import { TenantAiConfig } from '../ai-engine/entity/tenant-ai-config.entity';
import { ShopifyAdminClient } from '../order/shopify-admin.client';
import { ProductPopularService } from './product-popular.service';
import { ProductRecommendation } from './entity/product-recommendation.entity';
import { ProductRecommendationService } from './product-recommendation.service';
import { ProductRecommendationAdminController } from './product-recommendation.controller';
import { AuditModule } from '../audit/audit.module';
import { ProductLiveService } from './product-live.service';

@Module({
  // Tenant is registered for the repository only (storefront origin lookup) —
  // no TenantModule import needed for that. ProductSave likewise: repository-only,
  // the recommendation signal (A-10) reads the customer's saves by handle.
  // IntegrationCredential is read to tell a Shopify storefront from a Cafe24 mall,
  // whose catalogue arrives through Cafe24ProductSyncService instead.
  imports: [
    // TenantAiConfig: repository-only, the Product Help categories a public
    // popular-products read may ask about (ivy-docs T10 D3).
    TypeOrmModule.forFeature([
      ProductCache,
      ProductSave,
      Tenant,
      IntegrationCredential,
      KbDocument,
      Company,
      TenantAiConfig,
      // IVY PRD v1 A-01…A-04: per-category recommendation settings.
      ProductRecommendation,
    ]),
    SessionModule,
    // The store connection (token refresh included) for the live best-seller read.
    TenantModule,
    // Recommendation changes are audited (PRD slide 18 "change history").
    AuditModule,
  ],
  controllers: [ProductController, ProductAdminController, ProductRecommendationAdminController],
  // ShopifyAdminClient is stateless; OrderModule keeps its own instance.
  providers: [
    ProductService,
    ProductSyncService,
    ProductPopularService,
    ProductRecommendationService,
    ProductLiveService,
    ShopifyAdminClient,
  ],
  // ProductRecommendationService: the stock search behind the C-02 card note (IVY PRD v1).
  // ProductLiveService: store data for a typed product question (PLN-261126).
  exports: [ProductService, ProductSyncService, ProductRecommendationService, ProductPopularService, ProductLiveService],
})
export class ProductModule {}
