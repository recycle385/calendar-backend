import { GRACE_PERIOD, REFRESH_TOKEN_EXPIRES_IN } from '../../../constants/token.constants';
import { TokenService } from '../../../services/token.service';
import {
  IRedisBlacklistRepository,
  MainTokenPayload,
  ParticipantTokenPayload,
  RefreshTokenPayload,
  SignupTokenPayload,
} from '../../../types/token.types';
import { Errors } from '../../../utils/errors';
import { toSeconds } from '../../../utils/timeConverter';

jest.mock('../../../utils/jwt', () => {
  const actual = jest.requireActual('../../../utils/jwt'); // 원본 가져오기
  return {
    __esModule: true, // ES Module 처리
    ...actual, // 원본 함수들 유지
    verifyRefreshTokenSignature: jest.fn(), // 테스트할 함수만 Mock으로 덮어쓰기
    verifyRefreshTokenForRevoke: jest.fn(),
  };
});

import * as jwt from '../../../utils/jwt';

const mockRedisBlacklistRepository: jest.Mocked<IRedisBlacklistRepository> = {
  isOnBlacklist: jest.fn(),
  addToBlacklist: jest.fn(),
  recordUserAndRevokedAt: jest.fn(),
  getUserAndRevokedAt: jest.fn(),
};

describe('TokenService 테스트', () => {
  let tokenService: TokenService;

  beforeEach(() => {
    jest.clearAllMocks();

    mockRedisBlacklistRepository.addToBlacklist.mockResolvedValue(undefined);
    mockRedisBlacklistRepository.recordUserAndRevokedAt.mockResolvedValue(undefined);

    tokenService = new TokenService(mockRedisBlacklistRepository);
  });

  // 기본 jwt테스트 -----------------------------------------------------
  describe('ParticipantToken (Guest) 생성 및 검증', () => {
    interface ParticipantTestCase {
      role: string;
      payload: ParticipantTokenPayload;
    }

    const testCases: ParticipantTestCase[] = [
      {
        role: '게스트',
        payload: {
          sub: 'participant-uuid',
          nickname: 'Guest',
          calendarId: 'cal-slug-123',
          role: 'guest',
        },
      },
      {
        role: '게스트유저',
        payload: {
          sub: 'participant-uuid',
          nickname: 'GuestUser',
          calendarId: 'cal-slug-123',
          role: 'guest',
          userUuid: 'user-uuid1',
        },
      },
      {
        role: '호스트',
        payload: {
          sub: 'participant-uuid',
          nickname: 'HostUser',
          calendarId: 'cal-slug-123',
          role: 'host',
          userUuid: 'user-uuid2',
        },
      },
    ];

    it.each(testCases)(`$role 케이스: 토큰 생성 및 검증`, ({ payload }) => {
      const generateResult = tokenService.generateParticipantToken(payload);
      const verifiyResult = tokenService.verifyParticipantToken(generateResult);

      expect(verifiyResult).toEqual(expect.objectContaining(payload));
    });
  });

  describe('signupToken', () => {
    const mockSignupTokenPayload: SignupTokenPayload = {
      googleProfile: {
        oauth_id: 'oauth-12345',
        email: 'june@example.com',
        name: 'June',
        picture: 'http://example.com/june.jpg',
      },
    };

    it('signup토큰 생성 및 검증', () => {
      const generateResult = tokenService.generateSignupToken(mockSignupTokenPayload);
      const verifiyResult = tokenService.verifySignupToken(generateResult);

      expect(verifiyResult).toEqual(expect.objectContaining(mockSignupTokenPayload));
    });
  });

  describe('mainToken', () => {
    const mockMainTokenPayload: MainTokenPayload = {
      sub: 'user-uuid',
      role: 'host',
    };

    it('main토큰 생성 및 검증', () => {
      const generateResult = tokenService.generateMainToken(mockMainTokenPayload);
      const verifiyResult = tokenService.verifyMainToken(generateResult);

      expect(verifiyResult).toEqual(expect.objectContaining(mockMainTokenPayload));
    });
  });

  //---------------------------------------------------------------------------------------------
  describe('Refresh Token 관리', () => {
    const mockToken = 'mock-refresh-token';
    const mockPayload: RefreshTokenPayload = {
      sub: 'user-uuid-123',
      role: 'host',
      iat: Math.floor(Date.now() / 1000) - 3600, // 1시간 전 발급
      exp: Math.floor(Date.now() / 1000) + 3600, // 1시간 후 만료
      tokenId: 'unique-token-id', // [수정] jti -> tokenId
    };

    beforeEach(() => {
      // Mock 함수에 반환값 설정
      (jwt.verifyRefreshTokenSignature as jest.Mock).mockReturnValue(mockPayload);
      (jwt.verifyRefreshTokenForRevoke as jest.Mock).mockReturnValue(mockPayload);
    });

    // 1. Refresh Token Revoke (로그아웃 등)
    it('[로직] Refresh Token Revoke 시 블랙리스트에 추가되어야 한다', async () => {
      // revokeRefreshToken 메서드 실행
      await tokenService.revokeRefreshToken(mockToken);

      // 검증
      expect(jwt.verifyRefreshTokenForRevoke).toHaveBeenCalledWith(mockToken);
      expect(mockRedisBlacklistRepository.addToBlacklist).toHaveBeenCalledWith(
        mockPayload.tokenId,
        expect.any(Number), // expiresIn
        expect.any(String) // revokedAt
      );
    });

    // 2. 블랙리스트 유예 기간(GRACE_PERIOD) 내 요청 처리
    it('[로직] 블랙리스트에 있지만 유예 기간(GRACE_PERIOD) 내라면 검증을 통과해야 한다', async () => {
      const now = Math.floor(Date.now() / 1000);

      // Mock: 블랙리스트에 방금 전(유예 기간 내) 등록됨
      // 예: 현재시간 - 5초 (GRACE_PERIOD가 10초 이상이라고 가정)
      mockRedisBlacklistRepository.isOnBlacklist.mockResolvedValue(now - GRACE_PERIOD / 2);
      mockRedisBlacklistRepository.getUserAndRevokedAt.mockResolvedValue(null);

      const result = await tokenService.verifyRefreshToken(mockToken);

      expect(result).toEqual(mockPayload);
      expect(mockRedisBlacklistRepository.isOnBlacklist).toHaveBeenCalledWith(mockPayload.tokenId);
    });

    // 3. 유예 기간 초과 후 재사용 시 처리 (Security Breach)
    it('[로직] 유예 기간 초과 후 재사용 시 모든 토큰을 무효화(revokeAll)하고 에러를 던져야 한다', async () => {
      const now = Math.floor(Date.now() / 1000);

      // Mock: 블랙리스트 등록된 지 오래됨 (GRACE_PERIOD 초과)
      mockRedisBlacklistRepository.isOnBlacklist.mockResolvedValue(now - (GRACE_PERIOD + 100));

      await expect(tokenService.verifyRefreshToken(mockToken)).rejects.toThrow(
        '비정상적인 접근 감지: 블랙리스트 등록된 토큰'
      );

      // 해당 유저의 모든 토큰 무효화 로직이 실행되어야 함
      expect(mockRedisBlacklistRepository.recordUserAndRevokedAt).toHaveBeenCalledWith(
        mockPayload.sub,
        expect.any(Number),
        expect.any(String)
      );
    });

    // 4. 유저 자체가 차단된 경우
    it('[실패] 유저 전체가 차단(revokeAll)된 이후 발급된 토큰이 아니라면 에러를 던져야 한다', async () => {
      mockRedisBlacklistRepository.isOnBlacklist.mockResolvedValue(null);

      // Mock: 유저가 차단된 기록이 있음 (토큰 발급 시간 iat보다 나중)
      // 토큰 IAT: 100, 차단시점: 200 -> 이 토큰은 유효하지 않음
      mockRedisBlacklistRepository.getUserAndRevokedAt.mockResolvedValue(mockPayload.iat! + 100);

      await expect(tokenService.verifyRefreshToken(mockToken)).rejects.toThrow(
        '비정상적인 접근 감지: 블랙리스트 유저 완전차단'
      );

      // 이 경우에도 보안상 revokeAllRefreshTokens이 내부적으로 한 번 더 호출됩니다
      expect(mockRedisBlacklistRepository.recordUserAndRevokedAt).toHaveBeenCalled();
    });
  });
});
