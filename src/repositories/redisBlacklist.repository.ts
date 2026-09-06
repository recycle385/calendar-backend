import { RedisClientType } from 'redis';

export interface IRedisBlacklistRepository {
  isOnBlacklist(tokenId: string): Promise<number | null>;
  addToBlacklist(tokenId: string, expiresIn: number, revokedAt: string): Promise<void>;
  recordUserAndRevokedAt(userId: string, expiresIn: number, revokedAt: string): Promise<void>;
  getUserAndRevokedAt(userId: string): Promise<number | null>;
}

export class RedisBlacklistRepository implements IRedisBlacklistRepository {
  constructor(private redis: RedisClientType) {}

  /** 남은 시간을 리턴하는 블랙리스트 확인 메서드 */
  async isOnBlacklist(tokenId: string): Promise<number | null> {
    const key = `blacklist:${tokenId}`;

    const result = await this.redis.get(key);

    if (!result) return null;
    return parseInt(result, 10);
  }

  async addToBlacklist(tokenId: string, expiresIn: number, revokedAt: string): Promise<void> {
    const key = `blacklist:${tokenId}`;

    await this.redis.setEx(key, expiresIn, revokedAt);
  }

  async recordUserAndRevokedAt(
    userId: string,
    expiresIn: number,
    revokedAt: string
  ): Promise<void> {
    const key = `user_revoked_at:${userId}`;

    await this.redis.setEx(key, expiresIn, revokedAt);
  }

  async getUserAndRevokedAt(userId: string): Promise<number | null> {
    const key = `user_revoked_at:${userId}`;

    const result = await this.redis.get(key);

    if (!result) return null;
    return parseInt(result, 10);
  }
}
