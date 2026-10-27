-- 261027-file-unattributed-conversations.sql — DATA backfill, no schema change
-- (PLN-261027-LiveChat-Merge-Add-Missing-Session D2).
--
-- A conversation that started before the visitor signed in, and ENDED before
-- the sign-in, was never filed under the customer/company: the sign-in only
-- stamped open conversations. Such a session looked like a guest to the
-- merged room (staging go2joy: conversation 899 of laquan10). The code fix
-- (D1) files them at sign-in from now on; this files the ones already there.
--
-- 1) conversations filed under nobody, in a session whose identify attributes
--    name a known customer (user_id = customers.external_customer_id) and/or a
--    known hotel company (hotel_id → companies.external_key 'hotel:{id}');
-- 2) those sessions join the room of that customer/company when the room has
--    auto-join on and the session is not placed anywhere yet (added_by NULL =
--    auto, exactly what auto-join would have done).
-- Idempotent: step 1 only touches rows still filed under nobody, step 2 is
-- INSERT IGNORE on the (tenant, session) unique key and only for step 1's sessions.
-- The run prints the rows it files and the room each session ended up in.
--
-- Check first (how many rows each step touches):
--   SELECT COUNT(*) FROM conversations c JOIN sessions s ON s.id = c.session_id
--    WHERE c.customer_id IS NULL AND c.company_id IS NULL
--      AND JSON_EXTRACT(s.identity_attributes, '$.user_id') IS NOT NULL;

-- The conversations this run files — step 2 joins ONLY their sessions, so
-- sessions an operator deliberately left out of a room are not swept in.
-- (Run the whole file in ONE mysql client session: the table is temporary.)
DROP TEMPORARY TABLE IF EXISTS tmp_261027_filed;
CREATE TEMPORARY TABLE tmp_261027_filed AS
SELECT c.id AS conversation_id, c.tenant_id, c.session_id, cu.id AS customer_id, co.id AS company_id
  FROM conversations c
  JOIN sessions s ON s.id = c.session_id
  LEFT JOIN customers cu
         ON cu.tenant_id = s.tenant_id
        AND cu.external_customer_id = JSON_UNQUOTE(JSON_EXTRACT(s.identity_attributes, '$.user_id'))
  LEFT JOIN companies co
         ON co.tenant_id = s.tenant_id
        AND co.external_key = CONCAT('hotel:', JSON_UNQUOTE(JSON_EXTRACT(s.identity_attributes, '$.hotel_id')))
 WHERE c.customer_id IS NULL
   AND c.company_id IS NULL
   AND s.identity_attributes IS NOT NULL
   AND (cu.id IS NOT NULL OR co.id IS NOT NULL);

SELECT tenant_id, COUNT(*) AS conversations_to_file, COUNT(DISTINCT session_id) AS sessions FROM tmp_261027_filed GROUP BY tenant_id;

UPDATE conversations c
  JOIN tmp_261027_filed f ON f.conversation_id = c.id
   SET c.customer_id = f.customer_id,
       c.company_id  = f.company_id
 WHERE c.customer_id IS NULL
   AND c.company_id IS NULL;

INSERT IGNORE INTO merged_room_sessions (tenant_id, room_id, session_id, state, added_by, created_at)
SELECT f.tenant_id, MIN(r.id), f.session_id, 'member', NULL, NOW(6)
  FROM tmp_261027_filed f
  JOIN merged_rooms r
    ON r.tenant_id = f.tenant_id
   AND r.auto_join = 1
   AND (r.customer_id = f.customer_id OR r.company_id = f.company_id)
 WHERE NOT EXISTS (SELECT 1 FROM merged_room_sessions m WHERE m.tenant_id = f.tenant_id AND m.session_id = f.session_id)
 GROUP BY f.tenant_id, f.session_id;

SELECT f.tenant_id, f.conversation_id, f.session_id, m.room_id
  FROM tmp_261027_filed f LEFT JOIN merged_room_sessions m ON m.session_id = f.session_id AND m.tenant_id = f.tenant_id;

DROP TEMPORARY TABLE tmp_261027_filed;

-- Rollback: keep the printed list. Step 1: set customer_id/company_id back to
-- NULL for those conversation ids. Step 2: take the sessions out with [빼기]
-- in the console, or DELETE FROM merged_room_sessions by those session ids.
