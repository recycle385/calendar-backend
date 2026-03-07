import http from 'http';

import { app } from './app';
import { connectDatabaseWithRetry } from './config/database';
import { env } from './config/env';
import { connectRedis } from './config/redis';
import { cronService } from './containers/cron.container';
import { logger } from './middlewares/logger';
import { initializeSocketIO } from './sockets';
import { setupGracefulShutdown } from './utils/shutdownHandler';

process.on('uncaughtException', (err) => {
  logger.error('UNCAUGHT EXCEPTION:', { err });
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  logger.error('UNHANDLED REJECTION:', { reason });
});

async function startServer() {
  try {
    logger.info('서버 초기화');

    logger.info('reids 연결 시도');
    await connectRedis();
    logger.info('redis 연결 성공');

    logger.info('db 연결 시도');
    await connectDatabaseWithRetry();
    logger.info('reids, db 연결성공');

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
║  🔌 Redis: 연결됨             ║
║  💾 Database: 연결됨          ║
╚═══════════════════════════════╝
      `);
    });

    setupGracefulShutdown(server);
  } catch (error) {
    logger.error('서버 구동 실패:', { error });
    process.exit(1);
  }
}
// 서버 시작
startServer();
