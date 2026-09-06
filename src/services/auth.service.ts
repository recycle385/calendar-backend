import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';

import { env } from '../config/env';
import { TransactionManager } from '../infrastructure/transaction.manager';
import { User } from '../models';
import { CreateUserInput } from '../models';
import { IUserRepository } from '../repositories/user.repository';
import {
  ExistingUserResponse,
  GoogleProfileData,
  GoogleProfileOriginData,
  GoogleTokens,
  NewUserCallbackSignupResponse,
  NewUserImmediateSignupResponse,
  OAuthCallbackResponse,
} from '../types/auth.types';
import { TokenPair } from '../types/token.types';
import { Errors } from '../utils/errors';
import { ITokenService } from './token.service';

export interface IAuthService {
  handleGoogleCallback(code: string): Promise<OAuthCallbackResponse>;
  handleGoogleSignup(
    signUpToken: string,
    isTermsAgreed: boolean
  ): Promise<{ tokenPair: TokenPair; user: User }>;
  refreshToken(refreshToken: string): Promise<TokenPair>;
  revokeRefreshToken(token: string): Promise<void>;
}

export class AuthService implements IAuthService {
  constructor(
    private userRepository: IUserRepository,
    private tokenService: ITokenService
  ) {}

  //Google OAuth 콜백 처리
  public async handleGoogleCallback(code: string): Promise<OAuthCallbackResponse> {
    // 인증 코드로 구글 토큰
    const tokens = await this.getGoogleTokens(code);
    // 구글 토큰으로 사용자 정보
    const googleUser = await this.getGoogleUserProfile(tokens.access_token);

    // 사용자 찾기
    const existingUser = await this.userRepository.findByOauthId('google', googleUser.sub);

    // 기존 사용자 처리
    if (existingUser) {
      const existingUserResponse: ExistingUserResponse =
        await this.handleExistingUser(existingUser);
      return existingUserResponse;
    }

    // 신규사용자 처리
    const googleProfileData: GoogleProfileData = {
      oauth_id: googleUser.sub,
      email: googleUser.email,
      name: googleUser.name,
      picture: googleUser.picture,
    };

    if (env.SIGNUP_MODE == 'immediate') {
      const immediateSignupPayload = await this.signupProcess(googleProfileData, true);

      const newUserResponse: NewUserImmediateSignupResponse = {
        type: 'immediateSignup',
        token: immediateSignupPayload.tokenPair,
        user: immediateSignupPayload.user,
      };
      return newUserResponse;
    }

    const newUserResponse: NewUserCallbackSignupResponse =
      await this.handlePendingNewUser(googleProfileData);

    return newUserResponse;
  }

  public async handleGoogleSignup(
    signUpToken: string,
    isTermsAgreed: boolean
  ): Promise<{ tokenPair: TokenPair; user: User }> {
    if (!isTermsAgreed) {
      throw Errors.BadRequest('이용약관에 동의해야 회원가입이 가능합니다');
    }

    // 페이로드에서 구글 프로필 정보 검증 및 추출
    const payload = await this.tokenService.verifySignupToken(signUpToken);

    if (!payload) {
      throw Errors.BadRequest('유효하지 않은 회원가입 토큰입니다');
    }

    const signupProcessResult = await this.signupProcess(payload, isTermsAgreed);

    return signupProcessResult;
  }

  public async refreshToken(refreshToken: string): Promise<TokenPair> {
    const newTokenPair = await this.tokenService.refreshAccessToken(refreshToken);
    return newTokenPair;
  }

  public async revokeRefreshToken(token: string) {
    await this.tokenService.revokeRefreshToken(token);
  }

  /* private 메서드들 */

  /**신규유저 콜백가입(콜백 최종가입) */
  private async signupProcess(
    googleProfileData: GoogleProfileData,
    isTermsAgreed: boolean
  ): Promise<{ tokenPair: TokenPair; user: User }> {
    return await TransactionManager.run(async (connection) => {
      // 사용자 생성
      const newUserData: CreateUserInput = {
        user_uuid: uuidv4(),
        email: googleProfileData.email,
        oauth_provider: 'google',
        oauth_id: googleProfileData.oauth_id,
        nickname: googleProfileData.name,
        profile_image_url: googleProfileData.picture,
        isTermsAgreed: isTermsAgreed,
      };

      const createdNewUser = await this.userRepository.createUser(newUserData, connection);

      // 토큰 페어 생성
      const tokenPair: TokenPair = await this.tokenService.generateTokenPair(
        createdNewUser.user_uuid
      );

      return { tokenPair: tokenPair, user: createdNewUser };
    });
  }

  private async handleExistingUser(user: User): Promise<ExistingUserResponse> {
    const token: TokenPair = await this.tokenService.generateTokenPair(user.user_uuid);
    const existingUserResponse: ExistingUserResponse = {
      type: 'existingUser',
      token,
      user,
    };
    return existingUserResponse;
  }

  /**신규 유저처리 메서드(콜백 가입, 회원가입토큰 발급)*/
  private async handlePendingNewUser(
    user: GoogleProfileData
  ): Promise<NewUserCallbackSignupResponse> {
    const newUserToken = await this.tokenService.generateSignupToken(user);
    const newUserResponse: NewUserCallbackSignupResponse = {
      type: 'pendingSignup',
      signupToken: newUserToken,
    };

    return newUserResponse;
  }

  //구글 토큰 요청
  private async getGoogleTokens(code: string): Promise<GoogleTokens> {
    try {
      const { data } = await axios.post('https://oauth2.googleapis.com/token', {
        code,
        client_id: env.GOOGLE_CLIENT_ID,
        client_secret: env.GOOGLE_CLIENT_SECRET,
        redirect_uri: `${env.CLIENT_URL}/auth/callback`,
        grant_type: 'authorization_code',
      });
      return data;
    } catch (err) {
      throw Errors.ExternalApiError(err, '구글 인증 실패');
    }
  }

  //구글 사용자 프로필 요청
  private async getGoogleUserProfile(accessToken: string): Promise<GoogleProfileOriginData> {
    try {
      const { data } = await axios.get('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      return {
        sub: data.id,
        email: data.email,
        name: data.name,
        picture: data.picture,
      };
    } catch (err) {
      throw Errors.ExternalApiError(err, '구글 프로필을 불러오는 중 오류');
    }
  }
}
