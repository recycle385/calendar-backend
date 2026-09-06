import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';

import { env } from '../../../config/env';
import { CreateUserInput, User } from '../../../models';
import { IUserRepository } from '../../../repositories/user.repository';
import { AuthService } from '../../../services';
import { ITokenService } from '../../../services/token.service';
import { GoogleProfileData } from '../../../types/auth.types';
import { Errors } from '../../../utils/errors';

jest.mock('axios');
jest.mock('../../../infrastructure/transaction.manager', () => ({
  TransactionManager: {
    run: jest.fn((callback: (connection: unknown) => unknown) => callback({})),
  },
}));
jest.mock('uuid');

const mockUserRepository: jest.Mocked<IUserRepository> = {
  findByOauthId: jest.fn(),
  findUserInfoById: jest.fn(),
  findUserInfoByUuid: jest.fn(),
  getIdUsingUuid: jest.fn(),
  createUser: jest.fn(),
};

const mockTokenService: jest.Mocked<ITokenService> = {
  verifySignupToken: jest.fn(),
  verifyMainToken: jest.fn(),
  generateMainToken: jest.fn(),

  generateParticipantToken: jest.fn(),
  verifyParticipantToken: jest.fn(),

  generateSignupToken: jest.fn(),
  generateRefreshToken: jest.fn(),
  verifyRefreshToken: jest.fn(),
  generateTokenPair: jest.fn(),
  refreshAccessToken: jest.fn(),
  revokeRefreshToken: jest.fn(),
  revokeAllRefreshTokens: jest.fn(),
};

describe('AuthService 테스트', () => {
  let authService: AuthService;

  beforeEach(() => {
    jest.clearAllMocks();
    authService = new AuthService(mockUserRepository, mockTokenService);
  });

  //handleGoogleCallback ------------------------------------------
  describe('handleGoogleCallback', () => {
    const mockCode = 'auth_code';
    const mockGoogleTokens = { access_token: 'access_token', id_token: 'id_token' };
    const mockGoogleProfile = {
      id: 'google_123',
      email: 'test@example.com',
      name: '테스터',
      picture: 'profile.jpg',
    };

    beforeEach(() => {
      (axios.post as jest.MockedFunction<typeof axios.post>).mockResolvedValue({
        data: mockGoogleTokens,
      });
      (axios.get as jest.MockedFunction<typeof axios.get>).mockResolvedValue({
        data: mockGoogleProfile,
      });
    });

    afterEach(() => {
      (env as any).SIGNUP_MODE = 'immediate'; // 기본값으로 복구
    });

    // [happyCases]-----------------------------
    it('[성공] 기존 회원인 경우: existingUser 타입, 토큰 페어 반환', async () => {
      const existingUser: User = {
        id: 1,
        user_uuid: 'uuid-123',
        email: 'test@example.com',
        oauth_provider: 'google',
        oauth_id: 'google_123',
        nickname: '테스터',
        profile_image_url: 'image.jpg',
        isTermsAgreed: true,
        created_at: new Date(),
      };

      mockUserRepository.findByOauthId.mockResolvedValue(existingUser);
      const mockTokenPair = { accessToken: 'acc', refreshToken: 'ref' };
      mockTokenService.generateTokenPair.mockResolvedValue(mockTokenPair);

      const result = await authService.handleGoogleCallback(mockCode);

      expect(mockUserRepository.findByOauthId).toHaveBeenCalledWith('google', 'google_123');

      expect(result).toEqual({
        type: 'existingUser',
        token: mockTokenPair,
        user: existingUser,
      });
    });

    it('[성공] 신규 회원인 경우(Pending): pendingSignup 타입,signupToken 반환', async () => {
      const newUserPayload: GoogleProfileData = {
        oauth_id: mockGoogleProfile.id,
        email: mockGoogleProfile.email,
        name: mockGoogleProfile.name,
        picture: mockGoogleProfile.picture,
      };
      (env as any).SIGNUP_MODE = 'pending';
      mockUserRepository.findByOauthId.mockResolvedValue(null);

      const mockSignupToken = 'signupToken_string';
      mockTokenService.generateSignupToken.mockResolvedValue(mockSignupToken);

      const result = await authService.handleGoogleCallback(mockCode);

      expect(mockUserRepository.findByOauthId).toHaveBeenCalledWith('google', 'google_123');

      expect(mockTokenService.generateSignupToken).toHaveBeenCalledWith(newUserPayload);

      expect(result).toEqual({
        type: 'pendingSignup',
        signupToken: mockSignupToken,
      });
    });

    it('[성공] 신규 회원인 경우(Immediate): 자동 회원가입 후 immediateSignup 타입, 토큰 반환', async () => {
      const mockUuid = 'uuid-123';
      (uuidv4 as jest.Mock).mockReturnValue(mockUuid);

      const newUserData: CreateUserInput = {
        user_uuid: mockUuid,
        email: 'test@example.com',
        oauth_provider: 'google',
        oauth_id: 'google_123',
        nickname: '테스터',
        profile_image_url: 'profile.jpg',
        isTermsAgreed: true,
      };
      const createdNewUser: User = {
        id: 2,
        ...newUserData,
        created_at: new Date(),
      };
      (env as any).SIGNUP_MODE = 'immediate';

      mockUserRepository.findByOauthId.mockResolvedValue(null);
      const mockTokenPair = { accessToken: 'acc', refreshToken: 'ref' };
      mockUserRepository.createUser.mockResolvedValue(createdNewUser);
      mockTokenService.generateTokenPair.mockResolvedValue(mockTokenPair);

      const result = await authService.handleGoogleCallback(mockCode);

      expect(mockUserRepository.findByOauthId).toHaveBeenCalledWith('google', 'google_123');
      expect(mockUserRepository.createUser).toHaveBeenCalledWith(newUserData, expect.anything());
      expect(mockTokenService.generateTokenPair).toHaveBeenCalledWith(createdNewUser.user_uuid);

      expect(result).toEqual({
        type: 'immediateSignup',
        token: mockTokenPair,
        user: createdNewUser,
      });
    });

    // [failCases] ------------------------------
    it('[실패] Google API 호출 실패 (유효하지 않은 code)', async () => {
      (axios.post as jest.MockedFunction<typeof axios.post>).mockRejectedValue({
        response: {
          status: 400,
          data: { error: 'invalid_grant', error_description: 'Bad Request' },
        },
      });

      await expect(authService.handleGoogleCallback('invalid_code')).rejects.toThrow();
    });

    it('[실패] DB 연결 오류', async () => {
      mockUserRepository.findByOauthId.mockRejectedValue(new Error('DB Connection Refused'));

      await expect(authService.handleGoogleCallback(mockCode)).rejects.toThrow(
        'DB Connection Refused'
      );
    });

    it('[실패] DB 연결 오류: 신규 유저 생성(createUser) 중 에러 발생 시 에러를 던져야 한다(트랜잭션 테스트)', async () => {
      (env as any).SIGNUP_MODE = 'immediate';
      mockUserRepository.findByOauthId.mockResolvedValue(null);

      mockUserRepository.createUser.mockRejectedValue(new Error('Query Timeout'));

      await expect(authService.handleGoogleCallback(mockCode)).rejects.toThrow('Query Timeout');
    });
  });

  //handleGoogleSignup ------------------------------------------
  describe('handleGoogleSignup', () => {
    const mockGoogleProfile = {
      id: 'google_123',
      email: 'test@example.com',
      name: '테스터',
      picture: 'profile.jpg',
    };
    const newUserPayload: GoogleProfileData = {
      oauth_id: mockGoogleProfile.id,
      email: mockGoogleProfile.email,
      name: mockGoogleProfile.name,
      picture: mockGoogleProfile.picture,
    };
    const createdNewUser: User = {
      id: 2,
      user_uuid: 'uuid-123',
      email: newUserPayload.email,
      oauth_provider: 'google',
      oauth_id: newUserPayload.oauth_id,
      nickname: newUserPayload.name,
      profile_image_url: newUserPayload.picture,
      isTermsAgreed: true,
      created_at: new Date(),
    };
    const mockSignupToken = 'valid.signup.token';

    beforeEach(() => {
      mockTokenService.verifySignupToken.mockResolvedValue(newUserPayload);

      mockUserRepository.createUser.mockResolvedValue(createdNewUser);

      mockTokenService.generateTokenPair.mockResolvedValue({
        accessToken: 'access',
        refreshToken: 'ref',
      });
    });

    // [happyCase]-------------------------------------------------------------------
    it('[성공] 유효한 signuptoken과 약관동의시 회원생성 및 토큰발급', async () => {
      const mockUuid = 'uuid-123';
      (uuidv4 as jest.Mock).mockReturnValue(mockUuid);
      const mockIsTermsAgreed = true;
      const newUserData: CreateUserInput = {
        user_uuid: mockUuid,
        email: newUserPayload.email,
        oauth_provider: 'google',
        oauth_id: newUserPayload.oauth_id,
        nickname: newUserPayload.name,
        profile_image_url: newUserPayload.picture,
        isTermsAgreed: mockIsTermsAgreed,
      };

      const tokenPair = { accessToken: 'access', refreshToken: 'ref' };
      const result = await authService.handleGoogleSignup(mockSignupToken, mockIsTermsAgreed);

      expect(mockTokenService.verifySignupToken).toHaveBeenCalledWith(mockSignupToken);

      expect(mockUserRepository.createUser).toHaveBeenCalledWith(newUserData, expect.anything());

      expect(mockTokenService.generateTokenPair).toHaveBeenCalledWith(createdNewUser.user_uuid);

      expect(result).toEqual({
        tokenPair: tokenPair,
        user: createdNewUser,
      });
    });

    //[failCase]----------------------------------------------------------------------------------
    it('[실패] 약관 미동의시 BadRequest', async () => {
      const mockIsTermsAgreed = false;

      await expect(
        authService.handleGoogleSignup(mockSignupToken, mockIsTermsAgreed)
      ).rejects.toThrow('이용약관에 동의해야 회원가입이 가능합니다');

      expect(mockUserRepository.createUser).not.toHaveBeenCalled();
    });

    it('[실패] 토큰이 만료되었거나 변조된 경우 Unauthorized', async () => {
      mockTokenService.verifySignupToken.mockRejectedValue(
        Errors.Unauthorized('회원가입 토큰이 만료되었습니다')
      );

      await expect(authService.handleGoogleSignup('expiredToken', true)).rejects.toThrow(
        '회원가입 토큰이 만료되었습니다'
      );
      expect(mockUserRepository.createUser).not.toHaveBeenCalled();
    });

    it('[실패] 토큰이 변조된 경우 Unauthorized 에러를 던져야 한다', async () => {
      mockTokenService.verifySignupToken.mockRejectedValue(
        Errors.Unauthorized('유효하지 않은 회원가입 토큰입니다')
      );

      await expect(authService.handleGoogleSignup('invalidToken', true)).rejects.toThrow(
        '유효하지 않은 회원가입 토큰입니다'
      );
    });

    it('[실패] 만료되었거나 존재하지 않는 토큰이면 BadRequest', async () => {
      mockTokenService.verifySignupToken.mockResolvedValue(null);

      await expect(authService.handleGoogleSignup('invalidPayloadToken', true)).rejects.toThrow(
        '유효하지 않은 회원가입 토큰입니다'
      );
    });
  });

  // refreshToken ----------------------------------------------------------------------
  describe('refreshToken', () => {
    const mockRefreshToken = 'valid-refresh-token';
    const mockTokenPair = { accessToken: 'acc', refreshToken: 'ref' };

    it('[성공] 유효한 Refresh Token으로 새 토큰 페어를 반환', async () => {
      mockTokenService.refreshAccessToken.mockResolvedValue(mockTokenPair);

      const result = await authService.refreshToken(mockRefreshToken);

      expect(mockTokenService.refreshAccessToken).toHaveBeenCalledWith(mockRefreshToken);

      expect(result).toEqual(mockTokenPair);
    });

    it('[실패] TokenService에서 발생한 에러 그대로 throw', async () => {
      mockTokenService.refreshAccessToken.mockRejectedValue(
        Errors.Unauthorized('유효하지 않은 리프레시 토큰입니다')
      );

      await expect(authService.refreshToken(mockRefreshToken)).rejects.toThrow(
        '유효하지 않은 리프레시 토큰입니다'
      );
    });
  });
});
