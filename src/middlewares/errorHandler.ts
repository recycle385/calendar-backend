import { NextFunction, Request, RequestHandler, Response } from 'express';

import { env } from '../config/env';
import { AppError, Errors } from '../utils/errors';
import { logger } from './logger';

export const errorHandler = (err: unknown, req: Request, res: Response, next: NextFunction) => {
  const isError = err instanceof Error;

  // 운영 에러 (예상된 에러)
  if (err instanceof AppError && err.isOperational) {
    logger.warn({
      message: err.message,
      statusCode: err.statusCode,
      error: err.errorCode,
      url: req.originalUrl,
    });

    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
      ...(err.errorCode && { code: err.errorCode }),
      ...(err.details && { details: err.details }),
    });
  }

  // 예상하지 못한 에러
  logger.error({
    message: isError ? err.message : '알 수 없는 오류',
    stack: isError ? err.stack : undefined,
    url: req.originalUrl,
    method: req.method,
    body: req.body,
  });

  // 프로덕션에서는 상세 에러 숨김
  const message =
    env.NODE_ENV === 'production'
      ? '서버 내부 오류가 발생했습니다'
      : isError
        ? err.message
        : '알 수 없는 오류 발생';

  res.status(500).json({
    success: false,
    message,
    ...(env.NODE_ENV !== 'production' && isError && { stack: err.stack }),
  });
};

// 404 Not Found 핸들러
export const notFoundHandler = (req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    message: `${req.originalUrl} 경로를 찾을 수 없습니다`,
  });
};

export const asyncHandler = (fn: RequestHandler) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

export const safeAsyncHandler = <T extends Request>(
  guard: (req: Request) => req is T,
  fn: (req: T, res: Response, next: NextFunction) => Promise<void>
): RequestHandler => {
  return (req, res, next) => {
    if (guard(req)) {
      Promise.resolve(fn(req, res, next)).catch(next);
    } else {
      next(Errors.Internal('인증 데이터 무결성 검증 실패 (내부 배달 사고)'));
    }
  };
};
