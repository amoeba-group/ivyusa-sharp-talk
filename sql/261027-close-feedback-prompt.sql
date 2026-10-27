-- 261027-close-feedback-prompt.sql — widget × asks for feedback before closing
-- an ongoing conversation (PLN-261027-Widget-Close-Feedback-Prompt D5).
-- Apply BEFORE deploying the code (staging/production run DB_SYNCHRONIZE=false).
--
-- tenants.close_feedback_prompt  1 = on (default for every tenant), 0 = the × just closes.
-- No `AFTER <col>`: a database behind on earlier migrations would refuse it.
-- Idempotence: guard with `SHOW COLUMNS FROM tenants LIKE 'close_feedback_prompt'`.

ALTER TABLE `tenants`
  ADD COLUMN `close_feedback_prompt` TINYINT(1) NOT NULL DEFAULT 1;

-- Rollback:
--   ALTER TABLE `tenants` DROP COLUMN `close_feedback_prompt`;
