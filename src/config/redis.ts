import { createClient, RedisClientType } from 'redis';

import { logger } from '../middlewares/logger';
import { env } from './env';

const REDIS_URL = env.REDIS_URL;

let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 10;

const reconnectStrategy = (retries: number) => {
  reconnectAttempts = retries;

  // 최대 재연결 시도 제한
  if (retries > MAX_RECONNECT_ATTEMPTS) {
    logger.error(`Redis 재연결 ${MAX_RECONNECT_ATTEMPTS}회 실패`);
    return new Error('Max reconnect attempts reached');
  }

  return Math.min(retries * 50, 2000);
};

export const redisClient: RedisClientType = createClient({
  url: REDIS_URL,
  socket: {
    reconnectStrategy,
  },
});

redisClient.on('error', (err) => {
  logger.error('Redis Client 오류', err);
});
redisClient.on('connect', () => {
  reconnectAttempts = 0; // 연결 성공 시 카운터 리셋
  logger.info('Redis에 연결 중');
});
redisClient.on('ready', () => {
  logger.info('Redis 준비 완료');
});
redisClient.on('end', () => {
  logger.warn('Redis 연결 종료');
});

export async function connectRedis() {
  if (redisClient.isOpen) return;
  try {
    await redisClient.connect();
    logger.info('redis 연결 성공');
  } catch (err) {
    logger.error('redis 연결실패:', err);
    return false;
  }
}

export async function disconnectRedis() {
  if (!redisClient.isOpen) return;
  try {
    await redisClient.quit();
    logger.info('redis와 연결 정상해제');
  } catch (err) {
    logger.error('redis와 연결 해제 중 오류 발생:', err);
  }
}
