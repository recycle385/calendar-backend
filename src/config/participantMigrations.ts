import type { RowDataPacket } from 'mysql2/promise';

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

export async function ensureParticipantCalendarUserUniqueKey(): Promise<void> {
  if (await hasIndex('participants', 'unique_calendar_user')) {
    return;
  }

  const [duplicates] = await pool.query<RowDataPacket[]>(
    `SELECT calendar_id, user_id
     FROM participants
     WHERE user_id IS NOT NULL
     GROUP BY calendar_id, user_id
     HAVING COUNT(*) > 1
     LIMIT 1`
  );

  if (duplicates.length > 0) {
    throw new Error(
      'participants에 calendar_id + user_id 중복 데이터가 있어 unique_calendar_user를 추가할 수 없습니다.'
    );
  }

  await pool.query(
    'ALTER TABLE participants ADD UNIQUE KEY unique_calendar_user (calendar_id, user_id)'
  );
  logger.info('[Migration] participants.unique_calendar_user 추가 완료');
}
