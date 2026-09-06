-- Existing database migration for date_info upsert correctness.
-- New databases already use this key in src/models/schema/calendar_db.sql.
--
-- Why:
--   The old unique_date_seq key only allowed one row per (location_date, seq).
--   Public holidays and custom anniversaries can share the same date and seq
--   when their date_kind differs, so the upsert key must include date_kind.
--
-- How to run inside the MySQL container:
--   mysql -u calendar_user -p calendar_db < /path/to/20260711_update_date_info_unique_key.sql

SELECT COUNT(*) INTO @has_old_unique_date_seq
FROM information_schema.statistics
WHERE table_schema = DATABASE()
  AND table_name = 'date_info'
  AND index_name = 'unique_date_seq';

SET @drop_old_unique_date_seq = IF(
  @has_old_unique_date_seq > 0,
  'ALTER TABLE date_info DROP INDEX unique_date_seq',
  'SELECT ''unique_date_seq already absent'' AS migration_info'
);

PREPARE drop_old_unique_date_seq_stmt FROM @drop_old_unique_date_seq;
EXECUTE drop_old_unique_date_seq_stmt;
DEALLOCATE PREPARE drop_old_unique_date_seq_stmt;

SELECT COUNT(*) INTO @has_new_unique_date_kind_seq
FROM information_schema.statistics
WHERE table_schema = DATABASE()
  AND table_name = 'date_info'
  AND index_name = 'unique_date_kind_seq';

SET @add_new_unique_date_kind_seq = IF(
  @has_new_unique_date_kind_seq = 0,
  'ALTER TABLE date_info ADD UNIQUE KEY unique_date_kind_seq (location_date, date_kind, seq)',
  'SELECT ''unique_date_kind_seq already present'' AS migration_info'
);

PREPARE add_new_unique_date_kind_seq_stmt FROM @add_new_unique_date_kind_seq;
EXECUTE add_new_unique_date_kind_seq_stmt;
DEALLOCATE PREPARE add_new_unique_date_kind_seq_stmt;
