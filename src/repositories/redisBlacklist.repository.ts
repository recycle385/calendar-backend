import { RedisClientType } from 'redis';

import { logger } from '../middlewares/logger';
import { IRedisBlacklistRepository } from '../types/token.types';

export class RedisBlacklistRepository implements IRedisBlacklistRepository {
  constructor(private redis: RedisClientType) {}

  /** 남은 시간을 리턴하는 블랙리스트 확인 메서드 */
  async isOnBlacklist(tokenId: string): Promise<number | null> {
    const key = `blacklist:${tokenId}`;

    const result = await this.redis.get(key).catch((err) => {
      logger.error('Redis 블랙리스트 조회 중 오류 발생:', err);
    });

    if (!result) return null;
    return parseInt(result, 10);
  }

  async addToBlacklist(tokenId: string, expiresIn: number, revokedAt: string): Promise<void> {
    const key = `blacklist:${tokenId}`;

    await this.redis.setEx(key, expiresIn, revokedAt).catch((error) => {
      logger.error('Redis 블랙리스트 추가 중 오류 발생:', error);
    });
  }

  async recordUserAndRevokedAt(
    userId: string,
    expiresIn: number,
    revokedAt: string
  ): Promise<void> {
    const key = `user_revoked_at:${userId}`;

    await this.redis.setEx(key, expiresIn, revokedAt).catch((error) => {
      logger.error('Redis 사용자 무효화 시간 기록 중 오류 발생:', error);
    });
  }

  async getUserAndRevokedAt(userId: string): Promise<number | null> {
    const key = `user_revoked_at:${userId}`;

    const result = await this.redis.get(key).catch((err) => {
      logger.error('Redis 사용자 무효화 시간 조회 중 오류 발생:', err);
    });

    if (!result) return null;
    return parseInt(result, 10);
  }
}
