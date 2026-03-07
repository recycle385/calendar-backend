import jwt from 'jsonwebtoken';

import { env } from '../../config/env';
import { PARTICIPANT_TOKEN_EXPIRES_IN } from '../../constants/token.constants';
import { ParticipantTokenPayload } from '../../types/token.types';
import { Errors } from '../errors';
import { toSeconds } from '../timeConverter';
import { extractProperty, validateDecodedToken } from './helpers';

export function generateParticipantToken(
  payload: ParticipantTokenPayload,
  expiresIn: string = PARTICIPANT_TOKEN_EXPIRES_IN
): string {
  if (!payload.sub?.trim()) {
    throw Errors.Internal('유효하지 않은 토큰 페이로드');
  }

  try {
    const fullPayload: ParticipantTokenPayload = {
      ...payload,
    };

    const expirySeconds = { expiresIn: toSeconds(expiresIn) };
    return jwt.sign(fullPayload, env.JWT_SECRET, expirySeconds);
  } catch (error) {
    throw Errors.Internal('Participant Token 생성 중 오류 발생', error);
  }
}

export function verifyParticipantToken(token: string): ParticipantTokenPayload {
  let decoded: unknown;
  try {
    decoded = jwt.verify(token, env.JWT_SECRET);
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
  const calendarId = extractProperty.string(decoded, 'calendarId', '캘린더 ID');

  const user_uuid = extractProperty.nullableString(decoded, 'userUuid', '사용자 UUID');

  return {
    sub: subject,
    nickname: nickname,
    calendarId: calendarId,
    role: role,
    userUuid: user_uuid,
  };
}
