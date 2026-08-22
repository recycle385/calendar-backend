import cookieParser from 'cookie-parser';
import express from 'express';
import { describe, expect, it, jest } from '@jest/globals';
import request from 'supertest';

import { AuthController } from '../../../controllers/auth.controller';
import { errorHandler, asyncHandler } from '../../../middlewares/errorHandler';

type AuthService = ConstructorParameters<typeof AuthController>[0];

function createTestApp(authService: jest.Mocked<AuthService>) {
  const controller = new AuthController(authService);
  const app = express();

  app.use(cookieParser());
  app.get('/google', asyncHandler(controller.redirectToGoogle));
  app.get('/google/callback', asyncHandler(controller.handleGoogleCallback));
  app.use(errorHandler);

  return app;
}

function createMockAuthService(): jest.Mocked<AuthService> {
  return {
    handleGoogleCallback: jest.fn(),
    handleGoogleSignup: jest.fn(),
    refreshToken: jest.fn(),
    revokeRefreshToken: jest.fn(),
  };
}

describe('AuthController OAuth state', () => {
  it('Google 인증 URL의 state와 HttpOnly 쿠키 state가 일치해야 한다', async () => {
    const response = await request(createTestApp(createMockAuthService())).get('/google').expect(302);
    const loginUrl = new URL(response.headers.location);
    const setCookies = response.headers['set-cookie'] as unknown as string[];
    const stateCookie = setCookies.find((cookie) => cookie.startsWith('oauth_state='));
    const cookieState = stateCookie?.match(/^oauth_state=([^;]+)/)?.[1];

    expect(cookieState).toBeDefined();
    expect(loginUrl.searchParams.get('state')).toBe(cookieState);
    expect(stateCookie).toContain('HttpOnly');
    expect(stateCookie).toContain('SameSite=Lax');
  });

  it('callback state가 쿠키와 다르면 인증 코드를 교환하지 않는다', async () => {
    const authService = createMockAuthService();

    await request(createTestApp(authService))
      .get('/google/callback?code=google-code&state=attacker-state')
      .set('Cookie', 'oauth_state=expected-state')
      .expect(401);

    expect(authService.handleGoogleCallback).not.toHaveBeenCalled();
  });

  it('callback state 검증에 성공하면 쿠키를 폐기하고 인증 코드를 처리한다', async () => {
    const authService = createMockAuthService();
    authService.handleGoogleCallback.mockResolvedValue({
      type: 'pendingSignup',
      signupToken: 'signup-token',
    });

    const response = await request(createTestApp(authService))
      .get('/google/callback?code=google-code&state=expected-state')
      .set('Cookie', 'oauth_state=expected-state')
      .expect(200);

    expect(authService.handleGoogleCallback).toHaveBeenCalledWith('google-code');
    expect(response.headers['set-cookie']?.[0]).toContain('oauth_state=;');
  });
});
