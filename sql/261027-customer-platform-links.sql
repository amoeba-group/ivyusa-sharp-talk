-- 261027-customer-platform-links.sql — which platform accounts a person is known by
-- (PLN-261027-Console-Agent-Customer-Visibility S5, D12).
-- Apply BEFORE deploying the code (staging/production run DB_SYNCHRONIZE=false).
--
-- customer_platform_links  one row per (tenant, platform, platform customer id):
--                          shopify | cafe24 | woocommerce | haravan | odoo | identify.
--                          display_name is AES-256-GCM (same helper as customers.name),
--                          so the backfill below leaves it NULL — the next sync or
--                          sign-in fills it. Deleted on DSAR erasure.
-- Idempotence: CREATE TABLE IF NOT EXISTS + INSERT IGNORE on the unique key.

CREATE TABLE IF NOT EXISTS customer_platform_links (
  id             BIGINT         NOT NULL AUTO_INCREMENT,
  tenant_id      BIGINT         NOT NULL,
  customer_id    BIGINT         NOT NULL,
  provider       VARCHAR(24)    NOT NULL,
  external_id    VARCHAR(120)   NOT NULL,
  display_name   VARBINARY(512) NULL,
  first_seen_at  DATETIME       NOT NULL,
  last_seen_at   DATETIME       NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_cpl_tenant_provider_external (tenant_id, provider, external_id),
  KEY idx_cpl_tenant_customer (tenant_id, customer_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Backfill from what the customer rows already hold.
INSERT IGNORE INTO customer_platform_links (tenant_id, customer_id, provider, external_id, first_seen_at, last_seen_at)
SELECT tenant_id, id, 'shopify', shopify_customer_id, created_at, updated_at
  FROM customers WHERE tenant_id IS NOT NULL AND shopify_customer_id IS NOT NULL;
INSERT IGNORE INTO customer_platform_links (tenant_id, customer_id, provider, external_id, first_seen_at, last_seen_at)
SELECT tenant_id, id, 'cafe24', cafe24_member_id, created_at, updated_at
  FROM customers WHERE tenant_id IS NOT NULL AND cafe24_member_id IS NOT NULL;
INSERT IGNORE INTO customer_platform_links (tenant_id, customer_id, provider, external_id, first_seen_at, last_seen_at)
SELECT tenant_id, id, 'identify', external_customer_id, created_at, updated_at
  FROM customers WHERE tenant_id IS NOT NULL AND external_customer_id IS NOT NULL;

-- WooCommerce / Haravan / Odoo kept the platform id only on the cached orders
-- (member_id = 'woo-123' | 'haravan-123' | 'odoo-123').
INSERT IGNORE INTO customer_platform_links (tenant_id, customer_id, provider, external_id, first_seen_at, last_seen_at)
SELECT tenant_id, MAX(customer_id),
       CASE WHEN member_id LIKE 'woo-%' THEN 'woocommerce' WHEN member_id LIKE 'haravan-%' THEN 'haravan' ELSE 'odoo' END,
       SUBSTRING(member_id, LOCATE('-', member_id) + 1),
       MIN(created_at), MAX(updated_at)
  FROM orders_cache
 WHERE tenant_id IS NOT NULL AND customer_id IS NOT NULL
   AND (member_id LIKE 'woo-%' OR member_id LIKE 'haravan-%' OR member_id LIKE 'odoo-%')
 GROUP BY tenant_id, member_id;

-- Rollback:
--   DROP TABLE IF EXISTS customer_platform_links;
