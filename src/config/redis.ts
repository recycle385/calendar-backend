import { createClient, RedisClientType } from 'redis';

import { logger } from '../middlewares/logger';
import { env } from './env';

const REDIS_URL = env.REDIS_URL;

const STARTUP_WAIT_MS = 5000;
const MAX_RECONNECT_DELAY_MS = 30000;
let connectionAttempt: Promise<unknown> | undefined;

const reconnectStrategy = (retries: number) => {
  // 장애가 길어져도 복구를 포기하지 않으며 재시도 간격만 제한한다.
  return Math.min(100 * 2 ** Math.min(retries, 10), MAX_RECONNECT_DELAY_MS);
};

export const redisClient: RedisClientType = createClient({
  url: REDIS_URL,
  // 장애 중 인증 요청을 무기한 쌓지 않고 서비스 계층에서 503으로 처리한다.
  disableOfflineQueue: true,
  socket: {
    reconnectStrategy,
    connectTimeout: STARTUP_WAIT_MS,
  },
});

redisClient.on('error', (err) => {
  logger.error('Redis Client 오류', err);
});
redisClient.on('connect', () => {
  logger.info('Redis에 연결 중');
});
redisClient.on('ready', () => {
  logger.info('Redis 준비 완료');
});
redisClient.on('end', () => {
  logger.warn('Redis 연결 종료');
});

export async function connectRedis(): Promise<boolean> {
  if (redisClient.isReady) return true;

  // 서버 시작 대기는 제한하되 클라이언트는 백그라운드에서 계속 재연결한다.
  return new Promise<boolean>((resolve) => {
    const finish = (ready: boolean) => {
      clearTimeout(timer);
      redisClient.off('ready', onReady);
      redisClient.off('end', onEnd);
      resolve(ready);
    };
    const onReady = () => finish(true);
    const onEnd = () => finish(false);
    const timer = setTimeout(() => finish(false), STARTUP_WAIT_MS);
    redisClient.once('ready', onReady);
    redisClient.once('end', onEnd);

    if (!redisClient.isOpen && !connectionAttempt) {
      connectionAttempt = redisClient
        .connect()
        .catch((error) => {
          logger.error('redis 연결실패:', error);
          finish(false);
        })
        .finally(() => {
          connectionAttempt = undefined;
        });
    }
  });
}

export async function disconnectRedis() {
  if (!redisClient.isOpen) return;
  try {
    if (redisClient.isReady) {
      await redisClient.quit();
    } else {
      redisClient.destroy();
    }
    logger.info('redis와 연결 정상해제');
  } catch (err) {
    logger.error('redis와 연결 해제 중 오류 발생:', err);
  }
}
