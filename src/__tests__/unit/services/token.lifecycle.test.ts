import jwt from 'jsonwebtoken';
import type { RedisClientType } from 'redis';

import { env } from '../../../config/env';
import { GRACE_PERIOD } from '../../../constants/token.constants';
import { RedisBlacklistRepository } from '../../../repositories/redisBlacklist.repository';
import { IRedisSignupRepository } from '../../../repositories/redisSignup.repository';
import { TokenService } from '../../../services/token.service';
import { verifyRefreshTokenSignature } from '../../../utils/jwt/refreshToken';

jest.mock('../../../middlewares/logger', () => ({
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn() },
}));

describe('실제 JWT 발급부터 Redis 폐기 기록까지의 토큰 수명주기', () => {
  let now: number;
  let service: TokenService;
  let values: Map<string, string>;
  let set: jest.Mock;

  beforeEach(() => {
    now = Date.UTC(2026, 8, 6, 12);
    jest.spyOn(Date, 'now').mockImplementation(() => now);
    values = new Map();
    set = jest.fn(async (key: string, value: string, options: { NX?: boolean }) => {
      if (options.NX && values.has(key)) return null;
      values.set(key, value);
      return 'OK';
    });
    const redis = {
      get: jest.fn(async (key: string) => values.get(key) ?? null),
      set,
      setEx: jest.fn(async (key: string, _ttl: number, value: string) => {
        values.set(key, value);
        return 'OK';
      }),
    } as unknown as RedisClientType;
    service = new TokenService(new RedisBlacklistRepository(redis), {} as IRedisSignupRepository);
  });

  afterEach(() => jest.restoreAllMocks());

  it('로그아웃하면 같은 사용자의 다른 리프레시 토큰도 거부한다', async () => {
    const first = await service.generateRefreshToken('user');
    const second = await service.generateRefreshToken('user');
    expect(verifyRefreshTokenSignature(second).iat).toBe(now / 1000);

    await service.revokeRefreshToken(first);

    await expect(service.verifyRefreshToken(second)).rejects.toThrow('유저 완전차단');
    await expect(service.verifyRefreshToken(first)).rejects.toThrow('유저 완전차단');
  });

  it('동시 갱신과 유예 기간 내 재요청이 최초 폐기 시각을 연장하지 않는다', async () => {
    const token = await service.generateRefreshToken('user');
    await Promise.all([service.refreshAccessToken(token), service.refreshAccessToken(token)]);
    const key = `blacklist:${verifyRefreshTokenSignature(token).tokenId}`;
    const firstRevokedAt = values.get(key);

    now += (GRACE_PERIOD - 1) * 1000;
    await service.refreshAccessToken(token);
    expect(values.get(key)).toBe(firstRevokedAt);
    expect(set).toHaveBeenCalledWith(key, expect.any(String), {
      EX: expect.any(Number),
      NX: true,
    });

    now += 2000;
    await expect(service.refreshAccessToken(token)).rejects.toThrow('블랙리스트 등록된 토큰');
  });

  it.each(['전체 폐기', '로그아웃'])(
    '%s 이후 이전 세션의 재요청이 새 로그인을 폐기하지 않는다',
    async (reason) => {
      const oldToken = await service.generateRefreshToken('user');
      if (reason === '로그아웃') {
        await service.revokeRefreshToken(oldToken);
      } else {
        await service.revokeAllRefreshTokens('user');
      }
      now += (GRACE_PERIOD + 1) * 1000;
      const newToken = await service.generateRefreshToken('user');
      now += 1000;

      await expect(service.verifyRefreshToken(oldToken)).rejects.toThrow('유저 완전차단');
      await expect(service.verifyRefreshToken(newToken)).resolves.toMatchObject({ sub: 'user' });
    }
  );

  it('발급 시각이 없는 토큰은 전체 폐기 검사를 우회할 수 없다', () => {
    const token = jwt.sign(
      { sub: 'user', tokenId: 'missing-iat', role: 'host' },
      env.REFRESH_JWT_SECRET,
      { expiresIn: '1h', noTimestamp: true }
    );
    expect(() => verifyRefreshTokenSignature(token)).toThrow('iat');
  });
});
