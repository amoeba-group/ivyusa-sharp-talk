-- 261125-prd-v1-phase2-recommended-products.sql — product recommendations in two modes
-- (IVY PRD v1 A-01…A-04, PLN-261125-IVY-Recommended-Products §3.1).
--
-- product_recommendations   one row per (tenant, Product Help category, type):
--                           which mode answers "popular / recommended / new" questions
--                           for that category, and — for Admin Selected — the products
--                           in display order and the display period. No row = AI Auto.
--
-- Apply BEFORE deploying the code (production runs DB_SYNCHRONIZE=false). Old code +
-- new table = safe (nothing reads it); new code + no table = 500 on the console page
-- and the widget's popular products falling back to "unavailable".
--
-- Safe to run twice: CREATE TABLE IF NOT EXISTS.

CREATE TABLE IF NOT EXISTS product_recommendations (
  id               BIGINT       NOT NULL AUTO_INCREMENT,
  tenant_id        BIGINT       NOT NULL,
  category_handle  VARCHAR(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  rec_type         VARCHAR(16)  COLLATE utf8mb4_unicode_ci NOT NULL,
  mode             VARCHAR(16)  COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'auto',
  product_handles  JSON         NULL,
  starts_at        DATETIME     NULL,
  ends_at          DATETIME     NULL,
  updated_by       BIGINT       NULL,
  created_at       DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at       DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY uq_prod_rec (tenant_id, category_handle, rec_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Check:
--   SHOW CREATE TABLE product_recommendations;
--
-- Rollback (the old code never reads it):
--   DROP TABLE product_recommendations;
