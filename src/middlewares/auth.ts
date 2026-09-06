import { timingSafeEqual } from 'node:crypto';

import { NextFunction, Request, RequestHandler, Response } from 'express';
import jwt from 'jsonwebtoken';

import { env } from '../config/env';
import { tokenService } from '../containers/service.container';
import { MainTokenPayload, ParticipantTokenPayload } from '../types/token.types';
import { Errors } from '../utils/errors';

export interface AuthRequest extends Request {
  userUuid: string;
  userRole: 'host' | 'guest';
  nickname?: string;
}

export interface OptionalUserRequest extends Request {
  userUuid?: string;
  userRole?: 'host' | 'guest';
}
export interface UserRequest extends Request, MainTokenPayload {
  userUuid: MainTokenPayload['sub'];
  userRole: MainTokenPayload['role'];
}

export interface ParticipantRequest extends Request, ParticipantTokenPayload {
  participantUuid: ParticipantTokenPayload['sub'];
  userRole: ParticipantTokenPayload['role'];
  nickname: ParticipantTokenPayload['nickname'];
  calendarSlug: ParticipantTokenPayload['calendarSlug'];
  /** @deprecated legacy slug field */
  calendarId?: ParticipantTokenPayload['calendarId'];
  userUuid?: ParticipantTokenPayload['userUuid'];
}

// export function isAuthRequest(req: Request): req is AuthRequest & {
//   userUuid: string;
//   userRole: 'host' | 'guest';
//   nickname?: string;
// } {
//   return typeof req.userUuid === 'string' && (req.userRole === 'host' || req.userRole === 'guest');
// }

// export function isUserRequest(req: Request): req is UserRequest {
//   return typeof req.userUuid === 'string' && (req.userRole === 'host' || req.userRole === 'guest');
// }

// export function isParticipantRequest(req: Request): req is ParticipantRequest {
//   return typeof req.participantUuid === 'string' && typeof req.calendarId === 'string';
// }

export const authenticateUser: RequestHandler = (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      throw Errors.Unauthorized('인증 토큰이 필요합니다');
    }

    const decoded = tokenService.verifyMainToken(token);

    req.userUuid = decoded.sub;
    req.userRole = decoded.role;

    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return next(Errors.Unauthorized('토큰이 만료되었습니다'));
    }
    if (error instanceof jwt.JsonWebTokenError) {
      return next(Errors.Unauthorized('유효하지 않은 토큰입니다'));
    }
    next(error);
  }
};

export const authenticateParticipant: RequestHandler = (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      throw Errors.Unauthorized('인증 토큰이 필요합니다');
    }

    const decoded = tokenService.verifyParticipantToken(token);

    req.participantUuid = decoded.sub;
    req.userRole = decoded.role;
    req.nickname = decoded.nickname;
    req.calendarSlug = decoded.calendarSlug;
    req.calendarId = decoded.calendarSlug;

    req.userUuid = decoded.userUuid;

    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return next(Errors.Unauthorized('토큰이 만료되었습니다'));
    }
    if (error instanceof jwt.JsonWebTokenError) {
      return next(Errors.Unauthorized('유효하지 않은 토큰입니다'));
    }
    next(error);
  }
};

// 역할 기반 권한 확인
export const authorize = (...allowedRoles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.userRole) {
      return next(Errors.Unauthorized('인증이 필요합니다'));
    }

    if (!allowedRoles.includes(req.userRole)) {
      return next(Errors.Forbidden('접근 권한이 없습니다'));
    }

    next();
  };
};

// Optional 인증 (로그인 여부와 관계없이)
export const optionalAuth: RequestHandler = (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return next();
    }
    const decoded = tokenService.verifyMainToken(token);
    req.userUuid = decoded.sub;
    req.userRole = decoded.role;

    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return next(Errors.Unauthorized('토큰이 만료되었습니다'));
    }
    if (error instanceof jwt.JsonWebTokenError) {
      return next(Errors.Unauthorized('유효하지 않은 토큰입니다'));
    }
    next(error);
  }
};

export const authenticateOperator: RequestHandler = (req, res, next) => {
  const configuredToken = env.HOST_ACCESS_TOKEN;

  if (!configuredToken) {
    return next(Errors.Internal('운영자 인증 토큰이 설정되지 않았습니다'));
  }

  const providedToken = req.headers.authorization?.replace(/^Bearer\s+/i, '');
  if (!providedToken) {
    return next(Errors.Unauthorized('운영자 인증 토큰이 필요합니다'));
  }

  const configuredBuffer = Buffer.from(configuredToken);
  const providedBuffer = Buffer.from(providedToken);
  const isValid =
    configuredBuffer.length === providedBuffer.length &&
    timingSafeEqual(configuredBuffer, providedBuffer);

  if (!isValid) {
    return next(Errors.Forbidden('유효하지 않은 운영자 인증 토큰입니다'));
  }

  next();
};
