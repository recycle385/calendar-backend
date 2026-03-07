import http from 'http';

import { closeDatabaseConnection } from '../config/database';
import { disconnectRedis } from '../config/redis';

// 서비스 종료 처리(Graceful Shutdown)
async function gracefulShutdown(server: http.Server, signal: string) {
  console.log(`\n⚠️  ${signal} 신호를 감지했습니다. 서버 종료를 시작합니다...`);

  // 새 요청 받지 않기
  server.close(async () => {
    console.log('🔒 HTTP 서버가 정상적으로 종료되었습니다.');

    try {
      // 각종 연결 종료
      await disconnectRedis();
      await closeDatabaseConnection();

      console.log('✅ 모든 자원이 정상적으로 정리되었습니다. 종료합니다.');
      process.exit(0);
    } catch (err) {
      console.error('❌ 종료 과정에서 오류가 발생했습니다:', err);
      process.exit(1);
    }
  });

  // 30초 넘어가면 강제 종료
  setTimeout(() => {
    console.error('⏱️  30초가 지나 강제로 종료합니다.');
    process.exit(1);
  }, 30000);
}

export function setupGracefulShutdown(server: http.Server) {
  // 프로세스 이벤트 등록
  process.on('SIGTERM', () => gracefulShutdown(server, 'SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown(server, 'SIGINT'));

  process.on('uncaughtException', (err) => {
    console.error('💥 처리되지 않은 예외 발생:', err);
    gracefulShutdown(server, 'uncaughtException');
  });

  process.on('unhandledRejection', (reason, promise) => {
    console.error('💥 처리되지 않은 Promise 거부:', promise, '사유:', reason);
    gracefulShutdown(server, 'unhandledRejection');
  });
}
