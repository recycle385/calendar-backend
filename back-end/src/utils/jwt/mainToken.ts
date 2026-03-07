import jwt from 'jsonwebtoken';

import { env } from '../../config/env';
import { MAIN_TOKEN_EXPIRES_IN } from '../../constants/token.constants';
import { MainTokenPayload, UserTokenPayload } from '../../types/token.types';
import { Errors } from '../errors';
import { toSeconds } from '../timeConverter';
import { extractProperty, validateDecodedToken, validateRole } from './helpers';
import { toParticipantTokenPayload } from './participantToken';

//디코딩 결과를 MainTokenPayload로 변환
function toMainTokenPayload(decoded: unknown): MainTokenPayload {
  validateDecodedToken(decoded);
  validateRole(decoded, 'host');

  const subject = extractProperty.string(decoded, 'sub', '사용자 UUID');

  return {
    sub: subject,
    role: 'host',
  };
}

//방장용 Access Token 생성, 수명: 15분
export function generateMainToken(
  payload: Omit<MainTokenPayload, 'role'>,
  expiresIn: string = MAIN_TOKEN_EXPIRES_IN
): string {
  if (!payload.sub?.trim()) {
    throw Errors.Internal('유효하지 않은 토큰 페이로드');
  }

  try {
    const fullPayload: MainTokenPayload = {
      ...payload,
      role: 'host',
    };

    const expirySeconds = { expiresIn: toSeconds(expiresIn) };
    return jwt.sign(fullPayload, env.JWT_SECRET, expirySeconds);
  } catch (error) {
    throw Errors.Internal('Access Token 생성 중 오류 발생', error);
  }
}

//방장용 Access Token 검증
export function verifyMainToken(token: string): MainTokenPayload {
  let decoded: unknown;
  try {
    decoded = jwt.verify(token, env.JWT_SECRET);
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw Errors.Unauthorized('Access Token이 만료되었습니다');
    }
    if (error instanceof jwt.JsonWebTokenError) {
      throw Errors.Unauthorized('유효하지 않은 Access Token입니다');
    }
    throw Errors.Internal('토큰 검증 중 알 수 없는 오류', error);
  }
  return toMainTokenPayload(decoded);
}

//TODO: 안씀, 제거예정
export function verifyUserToken(token: string): UserTokenPayload {
  let decoded: unknown;

  try {
    decoded = jwt.verify(token, env.JWT_SECRET);
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw Errors.Unauthorized('만료된 토큰입니다');
    }
    if (error instanceof jwt.JsonWebTokenError) {
      throw Errors.Unauthorized('유효하지 않은 토큰입니다');
    }
    throw Errors.Internal('토큰 검증 중 알 수 없는 오류', error);
  }
  const role = extractProperty.string(decoded as Record<string, any>, 'role', '사용자 역할');

  if (role === 'host') {
    return toMainTokenPayload(decoded);
  }

  if (role === 'guest') {
    return toParticipantTokenPayload(decoded);
  }

  throw Errors.Unauthorized(`유효하지 않은 사용자 역할입니다: ${role}`);
}
