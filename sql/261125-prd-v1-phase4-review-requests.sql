-- 261125-prd-v1-phase4-review-requests.sql — IVY PRD v1.0 N-05: review request N days
-- after delivery (PLN-261125-IVY-PRD-v1-Phase4 §2.1)
--
--   fulfillments.delivered_at         When the order was delivered: Shopify's deliveredAt of
--                                     the last parcel (else its update time), or the moment a
--                                     webhook said so. Filled by the sync from now on; NULL on
--                                     rows delivered before this, until the sync reads them again.
--   fulfillments.review_requested_at  The review request for this order was handled (sent or
--                                     skipped). One request per order.
--   tenants.review_request_days       N days after delivery; NULL = off (every tenant today).
--   idx_ful_review_due                (tenant_id, status, delivered_at) for the hourly sweep.
--
-- Apply BEFORE deploying the code (production runs DB_SYNCHRONIZE=false): old code
-- + new columns = safe, new code + old schema = 500 on the widget settings page and
-- on every order sync that writes a delivery.
--
-- Idempotent: every column and the index are checked on their own, so a re-run or an
-- interrupted run is safe.

SET @db := DATABASE();

SET @sql := IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'fulfillments' AND COLUMN_NAME = 'delivered_at') = 0,
  'ALTER TABLE `fulfillments` ADD COLUMN `delivered_at` datetime NULL AFTER `tracking_url`',
  'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'fulfillments' AND COLUMN_NAME = 'review_requested_at') = 0,
  'ALTER TABLE `fulfillments` ADD COLUMN `review_requested_at` datetime NULL AFTER `delivered_at`',
  'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF(
  (SELECT COUNT(*) FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'fulfillments' AND INDEX_NAME = 'idx_ful_review_due') = 0,
  'ALTER TABLE `fulfillments` ADD INDEX `idx_ful_review_due` (`tenant_id`, `status`, `delivered_at`)',
  'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'tenants' AND COLUMN_NAME = 'review_request_days') = 0,
  'ALTER TABLE `tenants` ADD COLUMN `review_request_days` smallint NULL AFTER `chat_close_policy`',
  'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Check (4 rows):
--   SELECT TABLE_NAME, COLUMN_NAME, COLUMN_TYPE FROM information_schema.COLUMNS
--    WHERE TABLE_SCHEMA = DATABASE()
--      AND ((TABLE_NAME = 'fulfillments' AND COLUMN_NAME IN ('delivered_at', 'review_requested_at'))
--        OR (TABLE_NAME = 'tenants' AND COLUMN_NAME = 'review_request_days'))
--   UNION ALL
--   SELECT TABLE_NAME, INDEX_NAME, GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX) FROM information_schema.STATISTICS
--    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'fulfillments' AND INDEX_NAME = 'idx_ful_review_due'
--    GROUP BY TABLE_NAME, INDEX_NAME;
--
-- Rollback (the old code reads none of these):
--   ALTER TABLE `fulfillments` DROP INDEX `idx_ful_review_due`;
--   ALTER TABLE `fulfillments` DROP COLUMN `review_requested_at`, DROP COLUMN `delivered_at`;
--   ALTER TABLE `tenants` DROP COLUMN `review_request_days`;
