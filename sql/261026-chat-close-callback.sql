-- 261026-chat-close-callback.sql — rating request → auto close, and callback
-- requests (PLN-261026-Chat-Auto-Close D1/D5).
-- Apply BEFORE deploying the code (staging/production run DB_SYNCHRONIZE=false).
--
-- tenants.chat_close_policy  {csatAfterMin, closeAfterMin, csatPrompt?, closingNotice?,
--                            thanksNotice?}; NULL = the old platform rule (30 min of
--                            silence → "anything else?" → close, agent threads only).
-- callback_requests          a shopper's "call me back" with the contact to use.
--                            contact_enc is AES-256-GCM (same helper as customers.*);
--                            one open request per conversation (service-enforced).
-- No `AFTER <col>`: a database behind on earlier migrations would refuse it.
-- Idempotence: guard the ALTER with `SHOW COLUMNS FROM tenants LIKE 'chat_close_policy'`.

ALTER TABLE `tenants`
  ADD COLUMN `chat_close_policy` JSON NULL;

CREATE TABLE IF NOT EXISTS callback_requests (
  id              BIGINT        NOT NULL AUTO_INCREMENT,
  tenant_id       BIGINT        NOT NULL,
  conversation_id BIGINT        NOT NULL,
  session_id      BIGINT        NULL,
  customer_id     BIGINT        NULL,
  channel         VARCHAR(8)    NOT NULL,
  contact_source  VARCHAR(8)    NOT NULL,
  contact_enc     VARBINARY(512) NOT NULL,
  language        VARCHAR(8)    NULL,
  status          VARCHAR(16)   NOT NULL DEFAULT 'requested',
  handled_by      BIGINT        NULL,
  handled_at      DATETIME      NULL,
  created_at      DATETIME(6)   NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at      DATETIME(6)   NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  KEY idx_cb_tenant_status (tenant_id, status, created_at),
  KEY idx_cb_conversation (conversation_id),
  KEY idx_cb_customer (tenant_id, customer_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Rollback:
--   DROP TABLE IF EXISTS callback_requests;
--   ALTER TABLE `tenants` DROP COLUMN `chat_close_policy`;
