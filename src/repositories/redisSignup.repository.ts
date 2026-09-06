import { randomBytes } from 'node:crypto';

import type { RedisClientType } from 'redis';

import { logger } from '../middlewares/logger';
import type { GoogleProfileData } from '../types/auth.types';
import { Errors } from '../utils/errors';
import { isGoogleProfileData } from '../utils/jwt/helpers';

export interface IRedisSignupRepository {
  issueSignupToken(signupTokenPayload: GoogleProfileData): Promise<string>;
  verifySignupToken(signupToken: string): Promise<GoogleProfileData | null>;
}

export class RedisSignupRepository implements IRedisSignupRepository {
  constructor(private readonly redis: RedisClientType) {}

  async issueSignupToken(signupTokenPayload: GoogleProfileData): Promise<string> {
    const signupToken = randomBytes(32).toString('base64url');

    const key = `signup_token:${signupToken}`;
    const expiresIn = 10 * 60;

    try {
      await this.redis.setEx(key, expiresIn, JSON.stringify(signupTokenPayload));

      return signupToken;
    } catch (error) {
      logger.error('Redis 회원가입 토큰 저장 실패', { error });
      throw Errors.Internal('회원가입 토큰 저장 실패');
    }
  }

  async verifySignupToken(signupToken: string): Promise<GoogleProfileData | null> {
    const key = `signup_token:${signupToken}`;

    let tokenData: string | null;

    try {
      tokenData = await this.redis.getDel(key);
    } catch (error) {
      logger.error('Redis 회원가입 토큰 조회 실패', { error });
      throw Errors.Internal('회원가입 토큰 조회 실패');
    }

    if (!tokenData) {
      return null;
    }

    let parsedData: unknown;

    try {
      parsedData = JSON.parse(tokenData);
    } catch (error) {
      logger.error('회원가입 토큰 JSON 파싱 실패', { error });
      throw Errors.Internal('회원가입 토큰 데이터 형식 불일치');
    }

    if (!isGoogleProfileData(parsedData)) {
      logger.error('회원가입 토큰 데이터 형식 불일치');
      throw Errors.Internal('회원가입 토큰 데이터 형식 불일치');
    }

    return parsedData;
  }
}
