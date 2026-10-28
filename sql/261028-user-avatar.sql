-- 261028-user-avatar.sql — staff profile icon (PLN-261028-Agent-Profile-Avatar D1).
-- Apply BEFORE deploying the code (staging/production run DB_SYNCHRONIZE=false).
--
-- users.avatar_asset_uuid → tenant_assets.uuid (area 'profile', kind 'avatar');
-- NULL = no icon (the widget falls back to the tenant's agent avatar).
-- No `AFTER <col>`: a database behind on earlier migrations would refuse it.
-- Idempotence: guard with `SHOW COLUMNS FROM users LIKE 'avatar_asset_uuid'`.

ALTER TABLE `users`
  ADD COLUMN `avatar_asset_uuid` CHAR(36) NULL;

-- Rollback:
--   ALTER TABLE `users` DROP COLUMN `avatar_asset_uuid`;
