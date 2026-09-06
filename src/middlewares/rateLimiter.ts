import type { Request, Response } from 'express';
import rateLimit, { RateLimitRequestHandler } from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';

import { env } from '../config/env';
import { redisClient } from '../config/redis';
import { logger } from './logger';

const createRedisStore = (prefix: string) => {
  if (!env.ENABLE_RATE_LIMIT) {
    return undefined;
  }

  if (!redisClient.isReady) {
    logger.warn('Redis가 준비되지 않아 rate limit 메모리 store 사용', { prefix });
    return undefined;
  }

  try {
    return new RedisStore({
      sendCommand: async (...args: string[]) => {
        try {
          return await redisClient.sendCommand(args);
        } catch (error) {
          logger.error('Redis command 실행 실패', { prefix, error });
          throw error;
        }
      },
      prefix: `rate_limit:${prefix}:`,
    });
  } catch (error) {
    logger.error('Redis store 생성 실패, 메모리 store 사용', { prefix, error });
    return undefined;
  }
};

// 공통 설정
const commonConfig = {
  standardHeaders: true,
  legacyHeaders: false,
  skipFailedRequests: false,
  passOnStoreError: true,
};

// 공통 핸들러
const createHandler = (message: string, code: string, retryAfter?: number) => {
  return (req: Request, res: Response) => {
    logger.warn({
      message: 'Rate limit exceeded',
      ip: req.ip,
      url: req.originalUrl,
      code,
    });

    res.status(429).json({
      success: false,
      message,
      code,
      ...(retryAfter && { retryAfter }),
    });
  };
};

export const rateLimiter: RateLimitRequestHandler = rateLimit({
  ...commonConfig,
  windowMs: 15 * 60 * 1000,
  max: 100,
  store: createRedisStore('general'),
  handler: createHandler(
    '요청 제한을 초과했습니다. 잠시 후 다시 시도해주세요.',
    'RATE_LIMIT_EXCEEDED'
  ),
});

export const authRateLimiter: RateLimitRequestHandler = rateLimit({
  ...commonConfig,
  windowMs: 15 * 60 * 1000,
  max: 5,
  skipSuccessfulRequests: true,
  store: createRedisStore('auth'),
  handler: createHandler(
    '로그인 시도가 너무 많습니다. 15분 후 다시 시도해주세요.',
    'AUTH_RATE_LIMIT_EXCEEDED',
    900
  ),
});

export const strictRateLimiter: RateLimitRequestHandler = rateLimit({
  ...commonConfig,
  windowMs: 60 * 1000,
  max: 10,
  store: createRedisStore('strict'),
  handler: createHandler(
    '요청이 너무 빈번합니다. 1분 후 다시 시도해주세요.',
    'STRICT_RATE_LIMIT_EXCEEDED',
    60
  ),
});
