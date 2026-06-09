import { RequestHandler, Response } from 'express';

import { env } from '../config/env';
import { REFRESH_TOKEN_EXPIRES_IN } from '../constants/token.constants';
import { User } from '../models';
import { OAuthCallbackResponse, SafeUser } from '../types/auth.types';
import { TokenPair } from '../types/token.types';
import { IAuthService } from '../types/user.types';
import { Errors } from '../utils/errors';
import { toSeconds } from '../utils/timeConverter';

export class AuthController {
  constructor(private authService: IAuthService) {}

  private cookieOptions = {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
  };

  private clearRefreshTokenCookie(res: Response) {
    res.clearCookie('jwt', this.cookieOptions);
  }

  public redirectToGoogle: RequestHandler = async (req, res) => {
    const googleLoginUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${env.GOOGLE_CLIENT_ID}&redirect_uri=${env.CLIENT_URL}/auth/callback&response_type=code&scope=email profile`;
    return res.redirect(googleLoginUrl);
  };

  // 구글 OAuth 콜백 처리 (신규/기존 사용자 구분, 기존 사용자 바로 로그인)
  public handleGoogleCallback: RequestHandler = async (req, res) => {
    const { code } = req.query; // 구글에서 보내준 인증 코드

    const oAuthCallbackResponse: OAuthCallbackResponse =
      await this.authService.handleGoogleCallback(code as string);

    if (oAuthCallbackResponse.type == 'pendingSignup') {
      // 신규 사용자 처리 로직 (회원가입 페이지로 리디렉션)
      return res.status(200).json({
        message: '신규 사용자입니다. 회원가입을 진행해주세요.',
        signupToken: oAuthCallbackResponse.signupToken,
      });
    }

    res.cookie('jwt', oAuthCallbackResponse.token.refreshToken, {
      ...this.cookieOptions,
      maxAge: toSeconds(REFRESH_TOKEN_EXPIRES_IN),
    });

    return res.status(200).json({
      message: '로그인 성공',
      isNewUser: oAuthCallbackResponse.type !== 'existingUser',
      accessToken: oAuthCallbackResponse.token.accessToken,
      user: this.changeToSafeUser(oAuthCallbackResponse.user),
    });
  };

  public handleGoogleSignup: RequestHandler = async (req, res) => {
    const { signupToken, isTermsAgreed } = req.body;

    const signupResponse = await this.authService.handleGoogleSignup(signupToken, isTermsAgreed);

    res.cookie('jwt', signupResponse.tokenPair.refreshToken, {
      ...this.cookieOptions,
      maxAge: toSeconds(REFRESH_TOKEN_EXPIRES_IN),
    });

    return res.status(200).json({
      message: '회원가입 및 로그인 성공',
      accessToken: signupResponse.tokenPair.accessToken,
      user: this.changeToSafeUser(signupResponse.user),
    });
  };

  public refreshToken: RequestHandler = async (req, res) => {
    const refreshTokenCookie = req.cookies.jwt;
    if (!refreshTokenCookie) {
      this.clearRefreshTokenCookie(res);
      throw Errors.Unauthorized('Refresh Token이 제공되지 않았습니다');
    }

    try {
      const newTokenPair: TokenPair = await this.authService.refreshToken(refreshTokenCookie);

      res.cookie('jwt', newTokenPair.refreshToken, {
        ...this.cookieOptions,
        maxAge: toSeconds(REFRESH_TOKEN_EXPIRES_IN),
      });

      return res.status(200).json({
        message: '토큰 갱신 성공',
        accessToken: newTokenPair.accessToken,
      });
    } catch (err) {
      this.clearRefreshTokenCookie(res);
      throw err;
    }
  };

  public logout: RequestHandler = async (req, res) => {
    const refreshTokenCookie = req.cookies.jwt;
    if (!refreshTokenCookie) {
      this.clearRefreshTokenCookie(res);
      throw Errors.Unauthorized('Refresh Token이 제공되지 않았습니다');
    }

    await this.authService.revokeRefreshToken(refreshTokenCookie);

    this.clearRefreshTokenCookie(res);

    return res.status(200).json({ message: '로그아웃 성공' });
  };

  private changeToSafeUser(user: User): SafeUser {
    return {
      user_uuid: user.user_uuid,
      email: user.email,
      oauth_provider: user.oauth_provider,
      nickname: user.nickname,
      profile_image_url: user.profile_image_url,
      isTermsAgreed: user.isTermsAgreed,
      created_at: user.created_at,
    };
  }
}
