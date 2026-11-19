-- 261119-conversation-reads.sql — Live Chat read / unread per staff member
-- (PLN-261119-Console-LiveChat-Unread-And-Csat-Faces).
-- Apply BEFORE deploying the code (staging/production run DB_SYNCHRONIZE=false).
--
-- conversation_reads   how far one staff member has read one conversation: a
--                      customer message with an id above last_read_message_id
--                      is unread for that user. No row = nothing read.
--
-- Safe to run twice: the table is IF NOT EXISTS and the seed is INSERT IGNORE
-- on the unique key.

CREATE TABLE IF NOT EXISTS conversation_reads (
  id                   BIGINT      NOT NULL AUTO_INCREMENT,
  tenant_id            BIGINT      NOT NULL,
  conversation_id      BIGINT      NOT NULL,
  user_id              BIGINT      NOT NULL,
  last_read_message_id BIGINT      NOT NULL DEFAULT 0,
  updated_at           DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY uq_conv_read (conversation_id, user_id),
  KEY idx_conv_read_user (tenant_id, user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Seed: everything that exists today counts as read for every current staff
-- member of the tenant. Without it the whole history would light up as unread
-- the moment the feature ships. Only conversations that hold a message.
INSERT IGNORE INTO conversation_reads (tenant_id, conversation_id, user_id, last_read_message_id)
SELECT c.tenant_id, c.id, u.id, lm.last_id
  FROM conversations c
  JOIN (SELECT conversation_id, MAX(id) AS last_id FROM messages GROUP BY conversation_id) lm
    ON lm.conversation_id = c.id
  JOIN users u ON u.tenant_id = c.tenant_id
 WHERE c.tenant_id IS NOT NULL;

-- Rollback (after rolling the code back):
-- DROP TABLE conversation_reads;
