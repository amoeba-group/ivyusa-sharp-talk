-- 261112-inquiry-contact-form.sql — Contact Support form (ivy-docs T11, PLN-261112-IVY-T11 D3).
-- Apply BEFORE deploying the code (staging/production run DB_SYNCHRONIZE=false).
--
-- What the shopper typed in the widget's contact form, kept on the inquiry:
--   contact_name / contact_email / message — AES-256-GCM ciphertext (same helper
--     as customers.email / name / memo), cleared on erasure;
--   language — the widget language the form was sent in.
-- All nullable: rows from before the form keep NULL, and old code ignores them.
-- No `AFTER <col>`: a database behind on earlier migrations would refuse it.
-- Idempotence: guard with `SHOW COLUMNS FROM inquiries LIKE 'contact_email'`.

ALTER TABLE `inquiries`
  ADD COLUMN `contact_name` VARBINARY(512) NULL,
  ADD COLUMN `contact_email` VARBINARY(512) NULL,
  ADD COLUMN `message` VARBINARY(8192) NULL,
  ADD COLUMN `language` VARCHAR(8) NULL;

-- Rollback:
--   ALTER TABLE `inquiries`
--     DROP COLUMN `contact_name`,
--     DROP COLUMN `contact_email`,
--     DROP COLUMN `message`,
--     DROP COLUMN `language`;
