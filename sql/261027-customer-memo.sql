-- 261027-customer-memo.sql — operator memo on a personal customer
-- (PLN-261027-Console-Agent-Customer-Visibility S4, D11).
-- Apply BEFORE deploying the code (staging/production run DB_SYNCHRONIZE=false).
--
-- customers.memo  free-text note (≤2,000 chars), AES-256-GCM like name/email/phone
--                 (same transformer); cleared by DSAR erasure, included in export.
--                 8,192 bytes = 2,000 four-byte characters + IV + tag.
-- No `AFTER <col>`: a database behind on earlier migrations would refuse it.
-- Idempotence: guard with `SHOW COLUMNS FROM customers LIKE 'memo'`.

ALTER TABLE `customers`
  ADD COLUMN `memo` VARBINARY(8192) NULL;

-- Rollback:
--   ALTER TABLE `customers` DROP COLUMN `memo`;
