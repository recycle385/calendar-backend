import { Router } from 'express';

import { AUTH_ROUTES } from '../constants/routes.constants';
import { AuthController } from '../controllers/auth.controller';
import { asyncHandler } from '../middlewares/errorHandler';
import { authSchemas, validateBody, validateQuery } from '../middlewares/validation';

export const createAuthRouter = (controller: AuthController): Router => {
  const router = Router();

  /**
   * @swagger
   * /api/v1/auth/google:
   *   get:
   *     summary: 구글 OAuth 리디렉션
   *     tags: [Auth]
   *     description: "사용자를 구글 로그인 페이지로 리디렉션합니다."
   *     responses:
   *       302:
   *         description: "구글 로그인 페이지로 이동"
   */
  router.get(AUTH_ROUTES.GOOGLE, asyncHandler(controller.redirectToGoogle));

  /**
   * @swagger
   * /api/v1/auth/google/callback:
   *   get:
   *     summary: 구글 OAuth 콜백 처리
   *     tags: [Auth]
   *     description: |
   *       구글 인증 완료 후 리디렉션되는 콜백 API입니다.
   *       - 신규 사용자: `signupToken`을 반환하며 회원가입 페이지로 유도합니다.
   *       - 기존 사용자: 로그인 처리 후 `accessToken`을 반환하고 쿠키에 `refreshToken`을 설정합니다.
   *     parameters:
   *       - in: query
   *         name: code
   *         required: true
   *         schema:
   *           type: string
   *         description: "구글에서 발급한 인증 코드"
   *       - in: query
   *         name: state
   *         required: true
   *         schema:
   *           type: string
   *         description: "로그인 요청 위조 방지를 위한 일회성 상태값"
   *     responses:
   *       200:
   *         description: "인증 처리 성공"
   *         content:
   *           application/json:
   *             schema:
   *               oneOf:
   *                 - $ref: "#/components/schemas/GoogleCallbackResForNewUser"
   *                 - $ref: "#/components/schemas/GoogleCallbackResForExistingUser"
   */
  router.get(
    AUTH_ROUTES.GOOGLE_CALLBACK,
    validateQuery(authSchemas.callbackQuery),
    asyncHandler(controller.handleGoogleCallback)
  );

  /**
   * @swagger
   * /api/v1/auth/register:
   *   post:
   *     summary: 구글 회원가입 완료
   *     tags: [Auth]
   *     description: "임시 토큰(signupToken)과 약관 동의를 받아 회원가입을 완료하고 로그인을 처리합니다."
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: "#/components/schemas/GoogleSignupRequest"
   *     responses:
   *       200:
   *         description: "회원가입 및 로그인 성공"
   *         content:
   *           application/json:
   *             schema:
   *               $ref: "#/components/schemas/GoogleSignupResponse"
   */
  router.post(
    AUTH_ROUTES.SIGNUP,
    validateBody(authSchemas.signupRequest),
    asyncHandler(controller.handleGoogleSignup)
  );

  /**
   * @swagger
   * /api/v1/auth/refresh:
   *   post:
   *     summary: 액세스 토큰 갱신
   *     tags: [Auth]
   *     description: "쿠키의 Refresh Token을 사용하여 새로운 Access Token을 발급합니다."
   *     responses:
   *       200:
   *         description: "토큰 갱신 성공"
   *         content:
   *           application/json:
   *             schema:
   *               $ref: "#/components/schemas/RefreshTokenResponse"
   *       401:
   *         description: "Refresh Token이 없거나 만료되었습니다."
   */
  router.post(AUTH_ROUTES.REFRESH, asyncHandler(controller.refreshToken));

  /**
   * @swagger
   * /api/v1/auth/logout:
   *   post:
   *     summary: 로그아웃
   *     tags: [Auth]
   *     description: "리프레시 토큰을 무효화하고 쿠키를 삭제합니다."
   *     responses:
   *       200:
   *         description: "로그아웃 성공"
   *         content:
   *           application/json:
   *             schema:
   *               $ref: "#/components/schemas/DefaultResponseDto"
   */
  router.post(AUTH_ROUTES.LOGOUT, asyncHandler(controller.logout));

  return router;
};
