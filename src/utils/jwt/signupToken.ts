import jwt from 'jsonwebtoken';

import { env } from '../../config/env';
import { SIGNUP_TOKEN_EXPIRES_IN } from '../../constants/token.constants';
import { SignupTokenPayload } from '../../types/token.types';
import { Errors } from '../errors';
import { toSeconds } from '../timeConverter';
import { extractProperty, isGoogleProfileData, validateDecodedToken } from './helpers';

//디코딩 결과를 SignupTokenPayload로 변환
function toSignupTokenPayload(decoded: unknown): SignupTokenPayload {
  validateDecodedToken(decoded);
  const googleProfile = extractProperty.get(decoded, 'googleProfile');

  if (!isGoogleProfileData(googleProfile)) {
    throw Errors.Unauthorized('유효하지 않은 유저 데이터입니다');
  }

  return {
    googleProfile: googleProfile,
  };
}

//회원가입용 임시토큰 생성, 수명: 10분
export function generateSignupToken(
  payload: SignupTokenPayload,
  expiresIn: string = SIGNUP_TOKEN_EXPIRES_IN
): string {
  try {
    const fullPayload: SignupTokenPayload = {
      ...payload,
    };

    const options = { expiresIn: toSeconds(expiresIn) };
    return jwt.sign(fullPayload, env.JWT_SECRET, options);
  } catch (error) {
    throw Errors.Internal('Access Token 생성 중 오류 발생', error);
  }
}

//회원가입용 임시토큰 검증
export function verifySignupToken(token: string): SignupTokenPayload {
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
  return toSignupTokenPayload(decoded);
}
