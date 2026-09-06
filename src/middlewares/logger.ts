import { NextFunction, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import winston from 'winston';

import { env } from '../config/env';

// 로그 디렉토리 자동 생성
const logDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// Winston 로거 설정
export const logger = winston.createLogger({
  level: env.NODE_ENV === 'production' ? 'info' : 'debug', // env 사용
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), // 포맷 지정
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({
      filename: path.join(logDir, 'error.log'),
      level: 'error',
      maxsize: 5242880, // 5MB 제한
      maxFiles: 5, // 최대 5개 파일 보관
    }),
    new winston.transports.File({
      filename: path.join(logDir, 'combined.log'),
      maxsize: 5242880,
      maxFiles: 5,
    }),
  ],
});

// 개발 환경에서는 콘솔 출력
if (env.NODE_ENV !== 'production') {
  logger.add(
    new winston.transports.Console({
      format: winston.format.combine(winston.format.colorize(), winston.format.simple()),
    })
  );
}

// 민감 정보 필터링 함수
export const sanitizeData = (data: any): any => {
  if (!data || typeof data !== 'object') return data;

  const sensitiveFields = ['password', 'token', 'accessToken', 'refreshToken', 'secret'];
  const sanitized = { ...data };

  for (const key of Object.keys(sanitized)) {
    if (sensitiveFields.some((field) => key.toLowerCase().includes(field))) {
      sanitized[key] = '***REDACTED***';
    } else if (typeof sanitized[key] === 'object') {
      sanitized[key] = sanitizeData(sanitized[key]);
    }
  }

  return sanitized;
};

// 단일 로깅 미들웨어 (중복 제거)
export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();

  // 응답 완료 시 로깅
  res.on('finish', () => {
    const duration = Date.now() - start;
    const logData = {
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      duration: `${duration}ms`,
      userAgent: req.headers['user-agent'],
      ip: req.ip || req.socket.remoteAddress,
      // 민감 정보 필터링 후 로깅 (선택적)
      ...(env.NODE_ENV !== 'production' && {
        body: sanitizeData(req.body),
        query: sanitizeData(req.query),
      }),
    };

    // 상태 코드에 따라 로그 레벨 조정
    if (res.statusCode >= 500) {
      logger.error(logData);
    } else if (res.statusCode >= 400) {
      logger.warn(logData);
    } else {
      logger.info(logData);
    }
  });

  next();
};
