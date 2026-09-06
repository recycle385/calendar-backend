import jwt from 'jsonwebtoken';

import { env } from '../../config/env';
import { PARTICIPANT_TOKEN_EXPIRES_IN } from '../../constants/token.constants';
import { ParticipantTokenPayload } from '../../types/token.types';
import { Errors } from '../errors';
import { toSeconds } from '../timeConverter';
import { extractProperty, validateDecodedToken } from './helpers';
import { verifyWithOptionalLegacySecret } from './verifyWithFallback';

export function generateParticipantToken(
  payload: ParticipantTokenPayload,
  expiresIn: string = PARTICIPANT_TOKEN_EXPIRES_IN
): string {
  if (!payload.sub?.trim() || !payload.calendarSlug?.trim()) {
    throw Errors.Internal('유효하지 않은 토큰 페이로드');
  }

  try {
    const fullPayload: ParticipantTokenPayload = {
      ...payload,
      calendarId: undefined,
    };

    const expirySeconds = { expiresIn: toSeconds(expiresIn) };
    return jwt.sign(fullPayload, env.PARTICIPANT_JWT_SECRET, expirySeconds);
  } catch (error) {
    throw Errors.Internal('Participant Token 생성 중 오류 발생', error);
  }
}

export function verifyParticipantToken(token: string): ParticipantTokenPayload {
  let decoded: unknown;
  try {
    decoded = verifyWithOptionalLegacySecret(
      token,
      env.PARTICIPANT_JWT_SECRET,
      env.LEGACY_JWT_SECRET
    );
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw Errors.Unauthorized('Participant Token이 만료되었습니다');
    }
    if (error instanceof jwt.JsonWebTokenError) {
      throw Errors.Unauthorized('유효하지 않은 Participant Token입니다');
    }
    throw Errors.Internal('토큰 검증 중 알 수 없는 오류', error);
  }
  return toParticipantTokenPayload(decoded);
}

export function toParticipantTokenPayload(decoded: unknown): ParticipantTokenPayload {
  validateDecodedToken(decoded);

  const role = extractProperty.role(decoded, 'role', '역할');

  const subject = extractProperty.string(decoded, 'sub', '참가자 UUID');
  const nickname = extractProperty.string(decoded, 'nickname', '닉네임');
  const calendarSlug =
    extractProperty.nullableString(decoded, 'calendarSlug', '캘린더 slug') ??
    extractProperty.string(decoded, 'calendarId', '캘린더 slug');

  const user_uuid = extractProperty.nullableString(decoded, 'userUuid', '사용자 UUID');

  return {
    sub: subject,
    nickname: nickname,
    calendarSlug,
    role: role,
    userUuid: user_uuid,
  };
}
