import mysql from 'mysql2/promise';

import { env } from './env';

const MYSQL_UTC_TIME_ZONE = '+00:00';

const pool = mysql.createPool({
  host: env.DB_HOST,
  port: Number(process.env.DB_PORT) || 3306,
  user: env.DB_USER,
  password: env.DB_USER_PASSWORD,
  database: env.DB_NAME,
  timezone: 'Z',
  dateStrings: ['DATE'],
  waitForConnections: true,
  connectionLimit: env.DB_CONNECTION_LIMIT,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
});

pool.on('connection', (connection) => {
  void connection.query(`SET time_zone = '${MYSQL_UTC_TIME_ZONE}'`);
});

/**
 * DB 연결 시도 (재시도 + 지수 백오프)
 * - 연결 실패 시 일정 시간 대기 후 재시도
 * - 지수 백오프 방식으로 딜레이 증가
 */
export async function connectDatabaseWithRetry(retries = 5, initialDelayMs = 2000) {
  let delay = initialDelayMs;

  for (let i = 0; i < retries; i++) {
    try {
      const connection = await pool.getConnection();
      await connection.query(`SET time_zone = '${MYSQL_UTC_TIME_ZONE}'`);
      console.log('데이터베이스 연결 성공');
      connection.release();
      return;
    } catch (err) {
      console.error(
        `데이터베이스 연결 실패. ${delay / 1000}초 후 재시도합니다... (${i + 1}/${retries})`,
        err
      );

      if (i === retries - 1) {
        console.error('최대 재시도 횟수를 초과했습니다. 프로세스를 종료합니다.');
        process.exit(1);
      }

      await new Promise((res) => setTimeout(res, delay));
      delay *= 2;
    }
  }
}

export async function closeDatabaseConnection() {
  try {
    await pool.end();
    console.log('데이터베이스 연결 해제 완료');
  } catch (err) {
    console.error('데이터베이스 연결 해제 중 오류 발생:', err);
  }
}

export default pool;
