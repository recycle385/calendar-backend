import { DefaultResponseDto } from './common.dto';
/**
 * @swagger
 * components:
 *   schemas:
 *     SafeUserForDto:
 *       type: object
 *       properties:
 *         user_uuid:
 *           type: string
 *           example: "550e8400-e29b-41d4-a716-446655440000"
 *         email:
 *           type: string
 *           example: "user@example.com"
 *         oauth_provider:
 *           type: string
 *           enum: [google, kakao]
 *           example: "google"
 *         nickname:
 *           type: string
 *           example: "길동이"
 *         profile_image_url:
 *           type: string
 *           example: "https://example.com/profile.jpg"
 *         isTermsAgreed:
 *           type: boolean
 *           example: true
 *         created_at:
 *           type: string
 *           format: date-time
 *           example: "2026-02-24T12:00:00Z"
 */
export interface SafeUserForDto {
  user_uuid: string;
  email: string;
  oauth_provider: 'google' | 'kakao';
  nickname: string;
  profile_image_url: string;
  isTermsAgreed: boolean;
  created_at: Date;
}

/**
 * @swagger
 * components:
 *   schemas:
 *     GoogleCallbackResForNewUser:
 *       allOf:
 *         - $ref: "#/components/schemas/DefaultResponseDto"
 *         - type: object
 *           properties:
 *             signupToken:
 *               type: string
 *               description: "회원가입 완료를 위해 필요한 임시 토큰"
 *               example: "eyJhbGciOiJIUzI1Ni..."
 */
export interface GoogleCallbackResForNewUser extends DefaultResponseDto {
  signupToken: string;
}

/**
 * @swagger
 * components:
 *   schemas:
 *     GoogleCallbackResForExistingUser:
 *       allOf:
 *         - $ref: "#/components/schemas/DefaultResponseDto"
 *         - type: object
 *           properties:
 *             isNewUser:
 *               type: boolean
 *               example: false
 *             accessToken:
 *               type: string
 *               example: "eyJhbGciOiJIUzI1Ni..."
 *             user:
 *               $ref: "#/components/schemas/SafeUserForDto"
 */
export interface GoogleCallbackResForExistingUser extends DefaultResponseDto {
  isNewUser: boolean;
  accessToken: string;
  user: SafeUserForDto;
}

/**
 * @swagger
 * components:
 *   schemas:
 *     GoogleSignupRequest:
 *       type: object
 *       required:
 *         - signupToken
 *         - isTermsAgreed
 *       properties:
 *         signupToken:
 *           type: string
 *           description: "콜백에서 전달받은 임시 가입 토큰"
 *         isTermsAgreed:
 *           type: boolean
 *           description: "이용약관 동의 여부"
 */
export interface GoogleSignupRequest {
  signupToken: string;
  isTermsAgreed: boolean;
}

/**
 * @swagger
 * components:
 *   schemas:
 *     GoogleSignupResponse:
 *       allOf:
 *         - $ref: "#/components/schemas/DefaultResponseDto"
 *         - type: object
 *           properties:
 *             accessToken:
 *               type: string
 *             user:
 *               $ref: "#/components/schemas/SafeUserForDto"
 */
export interface GoogleSignupResponse extends DefaultResponseDto {
  accessToken: string;
  user: SafeUserForDto;
}

/**
 * @swagger
 * components:
 *   schemas:
 *     RefreshTokenResponse:
 *       allOf:
 *         - $ref: "#/components/schemas/DefaultResponseDto"
 *         - type: object
 *           properties:
 *             accessToken:
 *               type: string
 *               description: "새로 발급된 엑세스 토큰"
 */
export interface RefreshTokenResponse extends DefaultResponseDto {
  accessToken: string;
}
