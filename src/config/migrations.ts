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
  const changes: string[] = [];
  for (const index of ['unique_date_seq', 'unique_date_kind_seq']) {
    if (await hasIndex('date_info', index)) changes.push(`DROP INDEX ${index}`);
  }
  if (!(await hasIndex('date_info', 'unique_date_kind_seq_source'))) {
    changes.push(
      'ADD UNIQUE KEY unique_date_kind_seq_source (location_date, date_kind, seq, data_source)'
    );
  }
  if (changes.length === 0) return;

  // 한 번의 DDL로 교체해 기존 제약만 제거된 상태가 남지 않도록 한다.
  await pool.query(`ALTER TABLE date_info ${changes.join(', ')}`);
  logger.info('[Migration] date_info 출처별 유니크 키 적용 완료');
}

export async function runDatabaseMigrations(): Promise<void> {
  await migrateDateInfoUniqueKey();
}
