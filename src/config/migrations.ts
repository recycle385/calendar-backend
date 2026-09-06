import { RowDataPacket } from 'mysql2';

import { logger } from '../middlewares/logger';
import pool from './database';

interface CountRow extends RowDataPacket {
  count: number;
}

async function hasIndex(tableName: string, indexName: string): Promise<boolean> {
  const [rows] = await pool.query<CountRow[]>(
    `SELECT COUNT(*) AS count
     FROM information_schema.statistics
     WHERE table_schema = DATABASE()
       AND table_name = ?
       AND index_name = ?`,
    [tableName, indexName]
  );

  return Number(rows[0]?.count ?? 0) > 0;
}

async function migrateDateInfoUniqueKey(): Promise<void> {
  const hasOldUniqueKey = await hasIndex('date_info', 'unique_date_seq');
  if (hasOldUniqueKey) {
    await pool.query('ALTER TABLE date_info DROP INDEX unique_date_seq');
    logger.info('[Migration] date_info.unique_date_seq 제거 완료');
  }

  const hasNewUniqueKey = await hasIndex('date_info', 'unique_date_kind_seq');
  if (!hasNewUniqueKey) {
    await pool.query(
      'ALTER TABLE date_info ADD UNIQUE KEY unique_date_kind_seq (location_date, date_kind, seq)'
    );
    logger.info('[Migration] date_info.unique_date_kind_seq 추가 완료');
  }
}

export async function runDatabaseMigrations(): Promise<void> {
  await migrateDateInfoUniqueKey();
}
