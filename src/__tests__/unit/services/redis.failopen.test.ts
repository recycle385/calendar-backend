import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import { GRACE_PERIOD, REFRESH_TOKEN_EXPIRES_IN } from '../../../constants/token.constants';
import { TokenService } from '../../../services/token.service';
import { IRedisBlacklistRepository, RefreshTokenPayload } from '../../../types/token.types';
import { Errors } from '../../../utils/errors';
import { toSeconds } from '../../../utils/timeConverter';

/**
 * Redis 장애 시 Fail-open 하이브리드 전략 테스트
 *
 * Fail-open 전략이란:
 * - Redis 정상: Redis 블랙리스트 확인 + JWT 검증 (완전한 검증)
 * - Redis 장애: JWT 단독 검증 (제한된 검증이지만 서비스 계속 운영)
 *
 * 테스트 범위:
 * 1. Redis 장애 상황 재현
 * 2. Fail-open 분기 동작
 * 3. JWT 단독 검증 흐름
 */

jest.mock('../../../utils/jwt', () => {
  const actual = jest.requireActual('../../../utils/jwt') as any;
  return {
    __esModule: true,
    ...actual,
    verifyRefreshTokenSignature: jest.fn(),
    verifyRefreshTokenForRevoke: jest.fn(),
  };
});

import * as jwt from '../../../utils/jwt';

// ========================================================================================
// Mock 객체 정의
// ========================================================================================

const mockRedisBlacklistRepository: jest.Mocked<IRedisBlacklistRepository> = {
  isOnBlacklist: jest.fn(),
  addToBlacklist: jest.fn(),
  recordUserAndRevokedAt: jest.fn(),
  getUserAndRevokedAt: jest.fn(),
};

// ========================================================================================
// 테스트 헬퍼 함수
// ========================================================================================

/**
 * 유효한 Refresh Token Payload 생성
 */
const makeValidRefreshTokenPayload = (
  overrides: Partial<RefreshTokenPayload> = {}
): RefreshTokenPayload => ({
  sub: 'user-uuid-123',
  role: 'host',
  tokenId: 'unique-token-id-456',
  iat: Math.floor(Date.now() / 1000) - 3600, // 1시간 전 발급
  exp: Math.floor(Date.now() / 1000) + 86400, // 24시간 후 만료
  ...overrides,
});

/**
 * 만료된 Refresh Token Payload 생성
 */
const makeExpiredRefreshTokenPayload = (
  overrides: Partial<RefreshTokenPayload> = {}
): RefreshTokenPayload => ({
  ...makeValidRefreshTokenPayload(),
  exp: Math.floor(Date.now() / 1000) - 3600, // 이미 1시간 전에 만료됨
  ...overrides,
});

// ========================================================================================
// 테스트 스위트
// ========================================================================================

describe('Redis Fail-closed 인증 전략 테스트', () => {
  let tokenService: TokenService;
  const mockToken = 'mock-refresh-token';

  beforeEach(() => {
    jest.clearAllMocks();

    // 기본 Mock 설정
    mockRedisBlacklistRepository.addToBlacklist.mockResolvedValue(undefined);
    mockRedisBlacklistRepository.recordUserAndRevokedAt.mockResolvedValue(undefined);

    tokenService = new TokenService(mockRedisBlacklistRepository);
  });

  // ========================================================================================
  // 섹션 1: 정상 시나리오 (Redis 정상 작동)
  // ========================================================================================

  describe('섹션 1: Redis 정상 - 완전한 검증 흐름', () => {
    it('[정상] Redis 정상 + 유효한 토큰 + 블랙리스트 없음 -> 검증 성공', async () => {
      const payload = makeValidRefreshTokenPayload();
      (jwt.verifyRefreshTokenSignature as jest.Mock).mockReturnValue(payload);
      mockRedisBlacklistRepository.isOnBlacklist.mockResolvedValue(null); // 블랙리스트 없음
      mockRedisBlacklistRepository.getUserAndRevokedAt.mockResolvedValue(null); // 사용자 차단 없음

      const result = await tokenService.verifyRefreshToken(mockToken);

      expect(result).toEqual(payload);
      expect(mockRedisBlacklistRepository.isOnBlacklist).toHaveBeenCalledWith(payload.tokenId);
      expect(mockRedisBlacklistRepository.getUserAndRevokedAt).toHaveBeenCalledWith(payload.sub);
    });

    it('[정상] Redis 정상 + 블랙리스트 토큰 (유예기간 초과) -> 검증 실패', async () => {
      const now = Math.floor(Date.now() / 1000);
      const payload = makeValidRefreshTokenPayload();

      (jwt.verifyRefreshTokenSignature as jest.Mock).mockReturnValue(payload);
      // Redis에 토큰이 블랙리스트되어 있고, 유예기간을 초과함
      mockRedisBlacklistRepository.isOnBlacklist.mockResolvedValue(now - (GRACE_PERIOD + 100));

      await expect(tokenService.verifyRefreshToken(mockToken)).rejects.toThrow(
        '비정상적인 접근 감지: 블랙리스트 등록된 토큰'
      );

      expect(mockRedisBlacklistRepository.isOnBlacklist).toHaveBeenCalled();
    });

    it('[정상] Redis 정상 + 블랙리스트 토큰 (유예기간 내) -> 검증 성공 (Grace Period)', async () => {
      const now = Math.floor(Date.now() / 1000);
      const payload = makeValidRefreshTokenPayload();

      (jwt.verifyRefreshTokenSignature as jest.Mock).mockReturnValue(payload);
      // Redis에 토큰이 블랙리스트되어 있지만, 유예기간 내임
      mockRedisBlacklistRepository.isOnBlacklist.mockResolvedValue(now - 5); // 5초 전
      mockRedisBlacklistRepository.getUserAndRevokedAt.mockResolvedValue(null);

      // GRACE_PERIOD가 10초 이상이라고 가정하면 통과
      const result = await tokenService.verifyRefreshToken(mockToken);

      expect(result).toEqual(payload);
    });

    it('[정상] Redis 정상 + 사용자가 차단됨 -> 검증 실패', async () => {
      const payload = makeValidRefreshTokenPayload();
      const now = Math.floor(Date.now() / 1000);

      (jwt.verifyRefreshTokenSignature as jest.Mock).mockReturnValue(payload);
      mockRedisBlacklistRepository.isOnBlacklist.mockResolvedValue(null); // 토큰 블랙리스트는 없음
      // 하지만 사용자가 나중에 차단됨 (토큰 발급 시간 이후)
      mockRedisBlacklistRepository.getUserAndRevokedAt.mockResolvedValue(
        payload.iat! + 100 // 토큰 발급 후 100초 후에 차단
      );

      await expect(tokenService.verifyRefreshToken(mockToken)).rejects.toThrow(
        '비정상적인 접근 감지: 블랙리스트 유저 완전차단'
      );

      expect(mockRedisBlacklistRepository.getUserAndRevokedAt).toHaveBeenCalledWith(payload.sub);
    });
  });

  // ========================================================================================
  // 섹션 2: Redis 장애 - Fail-closed 동작
  // ========================================================================================

  describe('섹션 2: Redis 장애 - 인증 차단', () => {
    it('[Fail-closed] 토큰 블랙리스트를 확인할 수 없으면 검증을 거부한다', async () => {
      const payload = makeValidRefreshTokenPayload();
      (jwt.verifyRefreshTokenSignature as jest.Mock).mockReturnValue(payload);

      // ❌ Redis 장애: isOnBlacklist 호출 시 Promise rejection
      mockRedisBlacklistRepository.isOnBlacklist.mockRejectedValue(
        new Error('Redis connection timeout')
      );
      await expect(tokenService.verifyRefreshToken(mockToken)).rejects.toThrow(
        '인증 저장소를 일시적으로 사용할 수 없습니다'
      );
      expect(mockRedisBlacklistRepository.isOnBlacklist).toHaveBeenCalledWith(payload.tokenId);
      expect(mockRedisBlacklistRepository.getUserAndRevokedAt).not.toHaveBeenCalled();
    });

    it('[Fail-closed] 사용자 무효화 정보를 확인할 수 없으면 검증을 거부한다', async () => {
      const payload = makeValidRefreshTokenPayload({
        iat: Math.floor(Date.now() / 1000) - 3600, // iat 필수 (getUserAndRevokedAt 호출 조건)
      });
      (jwt.verifyRefreshTokenSignature as jest.Mock).mockReturnValue(payload);

      mockRedisBlacklistRepository.isOnBlacklist.mockResolvedValue(null); // 블랙리스트 조회는 정상
      // ❌ Redis 장애: getUserAndRevokedAt 호출 시 Promise rejection
      mockRedisBlacklistRepository.getUserAndRevokedAt.mockRejectedValue(
        new Error('Redis connection refused')
      );

      await expect(tokenService.verifyRefreshToken(mockToken)).rejects.toThrow(
        '인증 저장소를 일시적으로 사용할 수 없습니다'
      );
      expect(mockRedisBlacklistRepository.isOnBlacklist).toHaveBeenCalled();
      expect(mockRedisBlacklistRepository.getUserAndRevokedAt).toHaveBeenCalled();
    });

    it('[Fail-closed] Redis 전체 장애 중에는 JWT 서명만으로 갱신하지 않는다', async () => {
      const payload = makeValidRefreshTokenPayload({
        iat: Math.floor(Date.now() / 1000) - 3600,
      });
      (jwt.verifyRefreshTokenSignature as jest.Mock).mockReturnValue(payload);

      // ❌ 모든 Redis 작업 실패
      mockRedisBlacklistRepository.isOnBlacklist.mockRejectedValue(new Error('Redis unavailable'));
      mockRedisBlacklistRepository.getUserAndRevokedAt.mockRejectedValue(
        new Error('Redis unavailable')
      );

      await expect(tokenService.verifyRefreshToken(mockToken)).rejects.toThrow(
        '인증 저장소를 일시적으로 사용할 수 없습니다'
      );
      expect(mockRedisBlacklistRepository.getUserAndRevokedAt).not.toHaveBeenCalled();
    });
  });

  // ========================================================================================
  // 섹션 3: Fail-open + JWT 검증 실패
  // ========================================================================================

  describe('섹션 3: Redis 장애 중 JWT 검증 실패', () => {
    it('[Fail-open + JWT 실패] Redis 장애 + 잘못된 JWT 구조 -> 검증 실패', async () => {
      (jwt.verifyRefreshTokenSignature as jest.Mock).mockImplementation(() => {
        throw new Error('Invalid token format');
      });

      // Redis 장애 (호출되지 않을 것)
      mockRedisBlacklistRepository.isOnBlacklist.mockRejectedValue(
        new Error('Redis connection timeout')
      );

      // ❌ JWT 자체가 유효하지 않으면 실패
      await expect(tokenService.verifyRefreshToken(mockToken)).rejects.toThrow(
        'Invalid token format'
      );

      // JWT 검증에서 이미 실패했으므로 Redis 호출 없음
      expect(mockRedisBlacklistRepository.isOnBlacklist).not.toHaveBeenCalled();
    });

    it('[Fail-open + JWT 실패] Redis 장애 + 잘못된 JWT 서명 -> 검증 실패', async () => {
      (jwt.verifyRefreshTokenSignature as jest.Mock).mockImplementation(() => {
        throw new Error('Invalid token signature');
      });

      // Redis 장애
      mockRedisBlacklistRepository.isOnBlacklist.mockRejectedValue(
        new Error('Redis connection timeout')
      );

      // ❌ JWT 자체가 유효하지 않으면 실패
      await expect(tokenService.verifyRefreshToken(mockToken)).rejects.toThrow(
        'Invalid token signature'
      );

      // JWT 검증에서 이미 실패했으므로 Redis 호출 없음
      expect(mockRedisBlacklistRepository.isOnBlacklist).not.toHaveBeenCalled();
    });
  });

  // ========================================================================================
  // 섹션 4: Token Revoke 시 Fail-closed
  // ========================================================================================

  describe('섹션 4: Token Revoke 시 Redis 장애 처리', () => {
    it('[Fail-closed] revokeRefreshToken 중 기록 실패를 성공으로 보고하지 않는다', async () => {
      const payload = makeValidRefreshTokenPayload();
      (jwt.verifyRefreshTokenForRevoke as jest.Mock).mockReturnValue(payload);

      // Redis addToBlacklist 실패
      mockRedisBlacklistRepository.addToBlacklist.mockRejectedValue(
        new Error('Redis write failed')
      );
      mockRedisBlacklistRepository.recordUserAndRevokedAt.mockRejectedValue(
        new Error('Redis write failed')
      );

      await expect(tokenService.revokeRefreshToken(mockToken)).rejects.toThrow(
        '인증 저장소를 일시적으로 사용할 수 없습니다'
      );
      expect(mockRedisBlacklistRepository.addToBlacklist).toHaveBeenCalled();
      expect(mockRedisBlacklistRepository.recordUserAndRevokedAt).not.toHaveBeenCalled();
    });

    it('[Fail-closed] revokeAllRefreshTokens 기록 실패를 성공으로 보고하지 않는다', async () => {
      const userUuid = 'user-uuid-123';

      // Redis 장애
      mockRedisBlacklistRepository.recordUserAndRevokedAt.mockRejectedValue(
        new Error('Redis unavailable')
      );

      await expect(tokenService.revokeAllRefreshTokens(userUuid)).rejects.toThrow(
        '인증 저장소를 일시적으로 사용할 수 없습니다'
      );
      expect(mockRedisBlacklistRepository.recordUserAndRevokedAt).toHaveBeenCalled();
    });
  });

  // ========================================================================================
  // 섹션 5: 복합 시나리오 - Redis 복구 및 서비스 연속성
  // ========================================================================================

  describe('섹션 5: 복합 시나리오 - 서비스 연속성 검증', () => {
    it('[시나리오] Redis 장애 후 복구 -> 다시 완전 검증 작동', async () => {
      const payload = makeValidRefreshTokenPayload({
        iat: Math.floor(Date.now() / 1000) - 3600,
      });
      const now = Math.floor(Date.now() / 1000);

      (jwt.verifyRefreshTokenSignature as jest.Mock).mockReturnValue(payload);

      // 1️⃣ 첫 번째: Redis 장애
      mockRedisBlacklistRepository.isOnBlacklist.mockRejectedValueOnce(new Error('Redis timeout'));

      await expect(tokenService.verifyRefreshToken(mockToken)).rejects.toThrow(
        '인증 저장소를 일시적으로 사용할 수 없습니다'
      );

      // 2️⃣ 두 번째: Redis 복구됨
      mockRedisBlacklistRepository.isOnBlacklist.mockResolvedValueOnce(null); // Redis 정상
      mockRedisBlacklistRepository.getUserAndRevokedAt.mockResolvedValueOnce(null);

      const result2 = await tokenService.verifyRefreshToken(mockToken);
      expect(result2).toEqual(payload); // 이번엔 Redis도 포함하여 검증

      // 3️⃣ 세 번째: 토큰이 그 사이 블랙리스트됨 (Redis 정상)
      mockRedisBlacklistRepository.isOnBlacklist.mockResolvedValueOnce(now - 100);

      // 유예기간 초과로 에러 발생
      await expect(tokenService.verifyRefreshToken(mockToken)).rejects.toThrow();
    });

    it('[시나리오] 부분적 Redis 장애도 인증을 차단한다', async () => {
      const payload = makeValidRefreshTokenPayload({
        iat: Math.floor(Date.now() / 1000) - 3600,
      });
      (jwt.verifyRefreshTokenSignature as jest.Mock).mockReturnValue(payload);

      // isOnBlacklist는 성공, getUserAndRevokedAt는 실패
      mockRedisBlacklistRepository.isOnBlacklist.mockResolvedValue(null);
      mockRedisBlacklistRepository.getUserAndRevokedAt.mockRejectedValue(
        new Error('Redis partial failure')
      );

      await expect(tokenService.verifyRefreshToken(mockToken)).rejects.toThrow(
        '인증 저장소를 일시적으로 사용할 수 없습니다'
      );

      // 첫 번째 Redis 작업은 성공했으므로 호출됨
      expect(mockRedisBlacklistRepository.isOnBlacklist).toHaveBeenCalled();
      expect(mockRedisBlacklistRepository.getUserAndRevokedAt).toHaveBeenCalled();
    });
  });

  // ========================================================================================
  // 섹션 6: 보안 고려사항 - 장애 중 우회 방지
  // ========================================================================================

  describe('섹션 6: Redis 장애 중 토큰 재사용 차단', () => {
    it('[보안] 블랙리스트 상태를 알 수 없으면 토큰을 허용하지 않는다', async () => {
      const payload = makeValidRefreshTokenPayload({
        iat: Math.floor(Date.now() / 1000) - 3600,
      });
      (jwt.verifyRefreshTokenSignature as jest.Mock).mockReturnValue(payload);

      // Redis 장애
      mockRedisBlacklistRepository.isOnBlacklist.mockRejectedValue(new Error('Redis unavailable'));

      await expect(tokenService.verifyRefreshToken(mockToken)).rejects.toThrow(
        '인증 저장소를 일시적으로 사용할 수 없습니다'
      );
    });

    it('[보안] 사용자 차단 상태를 확인할 수 없을 때도 인증을 거부한다', async () => {
      const payload = makeValidRefreshTokenPayload({
        iat: Math.floor(Date.now() / 1000) - 3600,
      });
      (jwt.verifyRefreshTokenSignature as jest.Mock).mockReturnValue(payload);

      // Redis 장애
      mockRedisBlacklistRepository.isOnBlacklist.mockRejectedValue(new Error('Redis down'));
      mockRedisBlacklistRepository.getUserAndRevokedAt.mockRejectedValue(new Error('Redis down'));

      await expect(tokenService.verifyRefreshToken(mockToken)).rejects.toThrow(
        '인증 저장소를 일시적으로 사용할 수 없습니다'
      );
    });
  });
});
