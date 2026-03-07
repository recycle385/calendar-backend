import { PoolConnection } from 'mysql2/promise';

import pool from '../config/database';

export class TransactionManager {
  static async run<T>(callback: (connection: PoolConnection) => Promise<T>): Promise<T> {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      const result = await callback(connection);

      await connection.commit();
      return result;
    } catch (err) {
      try {
        await connection.rollback();
      } catch (rollbackErr) {
        console.error('Rollback 실패:', rollbackErr);
      }
      throw err;
    } finally {
      connection.release();
    }
  }
}
