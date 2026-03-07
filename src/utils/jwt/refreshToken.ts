import { randomUUID } from 'crypto';
import jwt from 'jsonwebtoken';

import { env } from '../../config/env';
import { REFRESH_TOKEN_EXPIRES_IN } from '../../constants/token.constants';
import { RefreshTokenPayload } from '../../types/token.types';
import { AppError, Errors } from '../errors';
import { toSeconds } from '../timeConverter';
import { extractProperty, isRefreshToken, validateDecodedToken } from './helpers';

// 디코딩 결과 RefreshTokenPayload로 변환
function toRefreshTokenPayload(decoded: unknown): RefreshTokenPayload {
  validateDecodedToken(decoded);

  const subject = extractProperty.string(decoded, 'sub', '사용자 UUID');
  const tokenId = extractProperty.string(decoded, 'tokenId', '토큰 ID');
  const exp = extractProperty.number(decoded, 'exp', '만료 시간');

  if (isRefreshToken(decoded) === false) {
    throw Errors.Unauthorized('유효하지 않은 Refresh Token입니다');
  }

  return {
    sub: subject,
    tokenId,
    role: 'host',
    exp: exp,
  };
}

// refresh token 자체 생성(서명만 담당)
export function signRefreshToken(
  sub: string,
  expiresIn: string = REFRESH_TOKEN_EXPIRES_IN
): { token: string; tokenId: string; expiresInSeconds: number } {
  if (!sub?.trim()) {
    throw Errors.Internal('유효하지 않은 사용자 ID');
  }

  const expirySeconds = toSeconds(expiresIn);
  const tokenId = randomUUID();

  const payload: RefreshTokenPayload = {
    sub,
    tokenId,
    role: 'host',
  };

  // jwt.sign은 숫자(초) 또는 문자열 허용 — 숫자 초 단위 사용
  const token = jwt.sign(payload, env.JWT_SECRET, { expiresIn: expirySeconds });

  return { token, tokenId, expiresInSeconds: expirySeconds };
}

// JWT 서명 검증
export function verifyRefreshTokenSignature(token: string): RefreshTokenPayload {
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET);
    return toRefreshTokenPayload(decoded);
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw Errors.Unauthorized('Refresh Token이 만료되었습니다');
    }
    handleJwtError(error);
  }
}
// jwt 서명검증 for revoke
export function verifyRefreshTokenForRevoke(token: string): RefreshTokenPayload {
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET, { ignoreExpiration: true });
    return toRefreshTokenPayload(decoded);
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      throw Errors.Unauthorized('유효하지 않은 Refresh Token입니다');
    }
    throw Errors.Internal('Refresh Token 서명 검증 중 오류', error);
  }
}

function handleJwtError(error: unknown): never {
  if (error instanceof AppError) {
    throw error;
  }
  if (error instanceof jwt.JsonWebTokenError) {
    throw Errors.Unauthorized('유효하지 않은 Refresh Token입니다');
  }
  throw Errors.Internal('Refresh Token 서명 검증 중 오류', error);
}
