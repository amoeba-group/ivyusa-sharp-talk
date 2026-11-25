-- 261125-prd-v1-phase1.sql — IVY PRD v1.0, phase 1 (PLN-261125-IVY-PRD-v1-Alignment §2.8)
--
--   inquiries.kind                 'inquiry' (answered by email) | 'feedback' (the
--                                  Feedback quick menu: kept for the admin, not mailed).
--                                  Every existing row is an inquiry, which the default says.
--   campaigns.target_customer_ids  JSON array of customer ids a campaign goes to;
--                                  NULL = every customer of the tenant (today's behaviour).
--
-- Apply BEFORE deploying the code (production runs DB_SYNCHRONIZE=false): old code
-- + new columns = safe, new code + old schema = 500 on the contact form and on
-- the campaigns page.
--
-- Idempotent: each column is checked on its own, so a re-run or an interrupted run
-- is safe.

SET @db := DATABASE();

SET @sql := IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'inquiries' AND COLUMN_NAME = 'kind') = 0,
  'ALTER TABLE `inquiries` ADD COLUMN `kind` varchar(16) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT ''inquiry'' AFTER `status`',
  'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'campaigns' AND COLUMN_NAME = 'target_customer_ids') = 0,
  'ALTER TABLE `campaigns` ADD COLUMN `target_customer_ids` json NULL AFTER `segment_ref`',
  'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Check:
--   SELECT COLUMN_NAME, COLUMN_TYPE, COLUMN_DEFAULT FROM information_schema.COLUMNS
--    WHERE TABLE_SCHEMA = DATABASE()
--      AND ((TABLE_NAME = 'inquiries' AND COLUMN_NAME = 'kind')
--        OR (TABLE_NAME = 'campaigns' AND COLUMN_NAME = 'target_customer_ids'));
--
-- Rollback (the old code reads neither column):
--   ALTER TABLE `inquiries` DROP COLUMN `kind`;
--   ALTER TABLE `campaigns` DROP COLUMN `target_customer_ids`;
