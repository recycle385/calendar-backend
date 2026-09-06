import cookieParser from 'cookie-parser';
import express from 'express';

export {
  authenticateOperator,
  authenticateParticipant,
  authenticateUser,
  authorize,
  optionalAuth,
} from './auth';
export { corsMiddleware } from './cors';
export { errorHandler, notFoundHandler } from './errorHandler';
export { requestLogger } from './logger';
export { authRateLimiter, rateLimiter } from './rateLimiter';
export { validateBody, validateParams, validateQuery } from './validation';

export function registerMiddlewares(app: express.Express) {
  app.use(express.json({ limit: '10mb' })); // JSON 요청 바디 파싱
  //app.use(express.urlencoded({ extended: true, limit: '10mb' })); // URL-encoded 요청 바디 파싱(폼데이터 요청 처리시 사용)
  app.use(cookieParser());
}
