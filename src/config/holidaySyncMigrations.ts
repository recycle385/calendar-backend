import { logger } from '../middlewares/logger';
import pool from './database';

export async function ensureHolidaySyncStatusTable(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS date_info_sync_status (
      year CHAR(4) NOT NULL,
      date_kind ENUM('01', '02', '03', '04', '05') NOT NULL,
      last_synced_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (year, date_kind)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  logger.info('[Migration] date_info_sync_status 확인 완료');
}
