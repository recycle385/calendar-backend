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

describe('Redis Fail-open 하이브리드 전략 테스트', () => {
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
  // 섹션 2: Redis 장애 - Fail-open 동작 (JWT 단독 검증)
  // ========================================================================================

  describe('섹션 2: Redis 장애 - Fail-open (JWT 단독 검증 모드)', () => {
    it('[Fail-open] Redis isOnBlacklist 장애 + 유효한 JWT -> 검증 성공 (JWT만 검증)', async () => {
      const payload = makeValidRefreshTokenPayload();
      (jwt.verifyRefreshTokenSignature as jest.Mock).mockReturnValue(payload);

      // ❌ Redis 장애: isOnBlacklist 호출 시 Promise rejection
      mockRedisBlacklistRepository.isOnBlacklist.mockRejectedValue(
        new Error('Redis connection timeout')
      );
      mockRedisBlacklistRepository.getUserAndRevokedAt.mockResolvedValue(null); // 이 부분은 호출되지 않아야 함

      // ✅ JWT 검증만으로 성공 (Redis 오류 무시)
      const result = await tokenService.verifyRefreshToken(mockToken);

      expect(result).toEqual(payload);
      expect(mockRedisBlacklistRepository.isOnBlacklist).toHaveBeenCalledWith(payload.tokenId);
      // Redis 장애 시에는 JWT 만으로 검증하므로, getUserAndRevokedAt는 호출되지 않음
    });

    it('[Fail-open] Redis getUserAndRevokedAt 장애 + 유효한 JWT -> 검증 성공 (JWT만 검증)', async () => {
      const payload = makeValidRefreshTokenPayload({
        iat: Math.floor(Date.now() / 1000) - 3600, // iat 필수 (getUserAndRevokedAt 호출 조건)
      });
      (jwt.verifyRefreshTokenSignature as jest.Mock).mockReturnValue(payload);

      mockRedisBlacklistRepository.isOnBlacklist.mockResolvedValue(null); // 블랙리스트 조회는 정상
      // ❌ Redis 장애: getUserAndRevokedAt 호출 시 Promise rejection
      mockRedisBlacklistRepository.getUserAndRevokedAt.mockRejectedValue(
        new Error('Redis connection refused')
      );

      // ✅ JWT 검증만으로 성공 (Redis 오류 무시)
      const result = await tokenService.verifyRefreshToken(mockToken);

      expect(result).toEqual(payload);
      expect(mockRedisBlacklistRepository.isOnBlacklist).toHaveBeenCalled();
      expect(mockRedisBlacklistRepository.getUserAndRevokedAt).toHaveBeenCalled();
    });

    it('[Fail-open] 양쪽 Redis 모두 장애 + 유효한 JWT -> 검증 성공 (JWT만 검증)', async () => {
      const payload = makeValidRefreshTokenPayload({
        iat: Math.floor(Date.now() / 1000) - 3600,
      });
      (jwt.verifyRefreshTokenSignature as jest.Mock).mockReturnValue(payload);

      // ❌ 모든 Redis 작업 실패
      mockRedisBlacklistRepository.isOnBlacklist.mockRejectedValue(new Error('Redis unavailable'));
      mockRedisBlacklistRepository.getUserAndRevokedAt.mockRejectedValue(
        new Error('Redis unavailable')
      );

      // ✅ JWT 검증만으로 성공
      const result = await tokenService.verifyRefreshToken(mockToken);

      expect(result).toEqual(payload);
      // Redis 장애에도 불구하고 서비스 계속 (Fail-open)
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
  // 섹션 4: Token Revoke 시 Fail-open
  // ========================================================================================

  describe('섹션 4: Token Revoke 시 Redis 장애 처리', () => {
    it('[Fail-open] revokeRefreshToken 중 addToBlacklist 실패 -> graceful 처리', async () => {
      const payload = makeValidRefreshTokenPayload();
      (jwt.verifyRefreshTokenForRevoke as jest.Mock).mockReturnValue(payload);

      // Redis addToBlacklist 실패
      mockRedisBlacklistRepository.addToBlacklist.mockRejectedValue(
        new Error('Redis write failed')
      );
      mockRedisBlacklistRepository.recordUserAndRevokedAt.mockRejectedValue(
        new Error('Redis write failed')
      );

      // ✅ Redis 오류에도 불구하고 로그만 하고 계속 진행 (Fail-open)
      const result = await tokenService.revokeRefreshToken(mockToken);

      // 전체 작업이 실패해도 false를 반환하고 진행
      expect(result).toBeDefined();
      expect(mockRedisBlacklistRepository.addToBlacklist).toHaveBeenCalled();
    });

    it('[Fail-open] revokeAllRefreshTokens 중 Redis 장애 -> graceful 처리', async () => {
      const userUuid = 'user-uuid-123';

      // Redis 장애
      mockRedisBlacklistRepository.recordUserAndRevokedAt.mockRejectedValue(
        new Error('Redis unavailable')
      );

      // ✅ Redis 오류에도 불구하고 계속 진행
      const result = await tokenService.revokeAllRefreshTokens(userUuid);

      expect(result).toBeDefined();
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

      const result1 = await tokenService.verifyRefreshToken(mockToken);
      expect(result1).toEqual(payload); // JWT만으로 검증 통과

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

    it('[시나리오] 부분적 Redis 장애 -> 사용 가능한 기능만 사용', async () => {
      const payload = makeValidRefreshTokenPayload({
        iat: Math.floor(Date.now() / 1000) - 3600,
      });
      (jwt.verifyRefreshTokenSignature as jest.Mock).mockReturnValue(payload);

      // isOnBlacklist는 성공, getUserAndRevokedAt는 실패
      mockRedisBlacklistRepository.isOnBlacklist.mockResolvedValue(null);
      mockRedisBlacklistRepository.getUserAndRevokedAt.mockRejectedValue(
        new Error('Redis partial failure')
      );

      // ✅ 부분적 장애도 Fail-open으로 처리
      const result = await tokenService.verifyRefreshToken(mockToken);
      expect(result).toEqual(payload);

      // 첫 번째 Redis 작업은 성공했으므로 호출됨
      expect(mockRedisBlacklistRepository.isOnBlacklist).toHaveBeenCalled();
      // 두 번째 Redis 작업은 실패했지만 계속 진행
      expect(mockRedisBlacklistRepository.getUserAndRevokedAt).toHaveBeenCalled();
    });
  });

  // ========================================================================================
  // 섹션 6: 보안 고려사항 - Fail-open의 한계
  // ========================================================================================

  describe('섹션 6: Fail-open 전략의 보안 영향도 분석', () => {
    it('[보안] Fail-open 중: 블랙리스트된 토큰도 허용됨 (알려진 제약)', async () => {
      const payload = makeValidRefreshTokenPayload({
        iat: Math.floor(Date.now() / 1000) - 3600,
      });
      (jwt.verifyRefreshTokenSignature as jest.Mock).mockReturnValue(payload);

      // Redis 장애
      mockRedisBlacklistRepository.isOnBlacklist.mockRejectedValue(new Error('Redis unavailable'));

      // ⚠️ Redis가 없으면 이미 로그아웃된 토큰도 허용됨
      // 이것이 Fail-open의 트레이드오프
      const result = await tokenService.verifyRefreshToken(mockToken);
      expect(result).toEqual(payload);

      // 하지만 모니터링과 로깅이 중요
      // TokenService에서 Redis 오류를 logger.error()로 기록해야 함
    });

    it('[보안] 사용자 완전 차단도 Fail-open 중에는 우회 가능', async () => {
      const payload = makeValidRefreshTokenPayload({
        iat: Math.floor(Date.now() / 1000) - 3600,
      });
      (jwt.verifyRefreshTokenSignature as jest.Mock).mockReturnValue(payload);

      // Redis 장애
      mockRedisBlacklistRepository.isOnBlacklist.mockRejectedValue(new Error('Redis down'));
      mockRedisBlacklistRepository.getUserAndRevokedAt.mockRejectedValue(new Error('Redis down'));

      // ⚠️ 사용자가 차단되었더라도 Redis 없으면 우회됨
      const result = await tokenService.verifyRefreshToken(mockToken);
      expect(result).toEqual(payload);

      // 권장: Redis 복구 후 영향받은 사용자에 대한 감사 로그 검토
    });
  });
});
