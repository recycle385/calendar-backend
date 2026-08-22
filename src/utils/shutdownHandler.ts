import http from 'http';

import { closeDatabaseConnection } from '../config/database';
import { disconnectRedis } from '../config/redis';
import { logger } from '../middlewares/logger';

let isShuttingDown = false;

async function closeResources(): Promise<boolean> {
  const results = await Promise.allSettled([disconnectRedis(), closeDatabaseConnection()]);
  const rejected = results.filter((result) => result.status === 'rejected');

  if (rejected.length > 0) {
    logger.error('종료 과정에서 일부 자원 정리에 실패했습니다.', { rejected });
    return false;
  }

  logger.info('모든 자원이 정상적으로 정리되었습니다.');
  return true;
}

// 서비스 종료 처리(Graceful Shutdown)
async function gracefulShutdown(server: http.Server, reason: string, exitCode: number) {
  if (isShuttingDown) {
    return;
  }
  isShuttingDown = true;

  logger.warn(`${reason} 감지: 서버 종료를 시작합니다.`);

  const forceExitTimer = setTimeout(() => {
    logger.error('30초 안에 종료되지 않아 프로세스를 강제 종료합니다.');
    process.exit(1);
  }, 30000);
  forceExitTimer.unref();

  // 새 요청 받지 않기
  server.close(async (error) => {
    clearTimeout(forceExitTimer);

    if (error) {
      logger.error('HTTP 서버 종료 중 오류가 발생했습니다.', { error });
    } else {
      logger.info('HTTP 서버가 정상적으로 종료되었습니다.');
    }

    const resourcesClosed = await closeResources();
    process.exit(error || !resourcesClosed ? 1 : exitCode);
  });
}

export function setupGracefulShutdown(server: http.Server) {
  process.once('SIGTERM', () => void gracefulShutdown(server, 'SIGTERM', 0));
  process.once('SIGINT', () => void gracefulShutdown(server, 'SIGINT', 0));

  process.once('uncaughtException', (error) => {
    logger.error('처리되지 않은 예외가 발생했습니다.', { error });
    void gracefulShutdown(server, 'uncaughtException', 1);
  });

  process.once('unhandledRejection', (reason) => {
    logger.error('처리되지 않은 Promise 거부가 발생했습니다.', { reason });
    void gracefulShutdown(server, 'unhandledRejection', 1);
  });
}
