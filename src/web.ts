import http from 'http';

import { connectDatabaseWithRetry } from './config/database';
import { env } from './config/env';
import { ensureHolidaySyncStatusTable } from './config/holidaySyncMigrations';
import { runDatabaseMigrations } from './config/migrations';
import { ensureParticipantCalendarUserUniqueKey } from './config/participantMigrations';
import { connectRedis, redisClient } from './config/redis';
import { cronService } from './containers/cron.container';
import { logger } from './middlewares/logger';
import { initializeSocketIO } from './sockets';
import { setupGracefulShutdown } from './utils/shutdownHandler';

async function startServer() {
  try {
    logger.info('서버 초기화');

    logger.info('redis 연결 시도');
    const isRedisConnected = await connectRedis();
    logger.info(isRedisConnected ? 'redis 연결 성공' : 'redis 연결 실패, fail-open 모드로 시작');

    // rate limiter가 Redis 연결 상태를 확인한 뒤 store를 선택하도록 app을 지연 로딩한다.
    const { app } = await import('./app');

    logger.info('db 연결 시도');
    await connectDatabaseWithRetry();
    await ensureHolidaySyncStatusTable();
    await runDatabaseMigrations();
    await ensureParticipantCalendarUserUniqueKey();
    logger.info('db 연결 및 마이그레이션 성공');

    const server = http.createServer(app);
    initializeSocketIO(server);

    cronService.start();
    logger.info('[Cron] 서비스 시작 (매일 새벽 4시 실행)');

    server.listen(env.PORT, () => {
      logger.info(`
╔═══════════════════════════════╗
║  🚀 서버가 실행 중 입니다!    ║
║  📡 Port: ${env.PORT}                ║
║  🌍 Env: ${env.NODE_ENV}          ║
║  🔌 Redis: ${redisClient.isReady ? '연결됨' : '연결 안 됨'}             ║
║  💾 Database: 연결됨          ║
╚═══════════════════════════════╝
      `);

      cronService.runHolidayUpdate().catch((error) => {
        logger.error('[Cron] 서버 시작 시 공휴일 정보 업데이트 실패:', { error });
      });
    });

    setupGracefulShutdown(server);
  } catch (error) {
    logger.error('서버 구동 실패:', { error });
    process.exit(1);
  }
}
// 서버 시작
startServer();
