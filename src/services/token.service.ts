import { GRACE_PERIOD, REFRESH_TOKEN_EXPIRES_IN } from '../constants/token.constants';
import { logger } from '../middlewares/logger';
import {
  IRedisBlacklistRepository,
  ITokenService,
  MainTokenPayload,
  ParticipantTokenPayload,
  RefreshTokenPayload,
  SignupTokenPayload,
  TokenPair,
  UserTokenPayload,
} from '../types/token.types';
import { Errors } from '../utils/errors';
import * as jwt from '../utils/jwt';
import { toSeconds } from '../utils/timeConverter';

export class TokenService implements ITokenService {
  constructor(private redisBlacklist: IRedisBlacklistRepository) {}

  private async useAuthStore<T>(operation: string, task: () => Promise<T>): Promise<T> {
    try {
      return await task();
    } catch (error) {
      logger.error(`인증 저장소 ${operation} 실패`, error);
      throw Errors.ServiceUnavailable();
    }
  }

  /*
    토큰에 대한 단일 책임을 위해 퍼사드 패턴으로 jwt 유틸 메서드 호출 후 반환 --------------------------------
*/

  // 회원가입 토큰----------------------------------------

  public verifySignupToken(token: string) {
    return jwt.verifySignupToken(token);
  }

  public generateSignupToken(payload: SignupTokenPayload, expiresIn?: string): string {
    return jwt.generateSignupToken(payload, expiresIn);
  }

  // 메인토큰 --------------------------------

  public generateMainToken(payload: MainTokenPayload, expiresIn?: string): string {
    return jwt.generateMainToken(payload, expiresIn);
  }

  public verifyMainToken(token: string): MainTokenPayload {
    return jwt.verifyMainToken(token);
  }

  // TODO: 안씀 지울 예정
  public verifyUserToken(token: string): UserTokenPayload {
    return jwt.verifyUserToken(token);
  }

  // 참가자 토큰 ----------------------------------------------------

  public generateParticipantToken(payload: ParticipantTokenPayload, expiresIn?: string): string {
    return jwt.generateParticipantToken(payload, expiresIn);
  }

  public verifyParticipantToken(token: string): ParticipantTokenPayload {
    return jwt.verifyParticipantToken(token);
  }

  /*
    리프레쉬 토큰 -----------------------------------------------------------------------
*/
  public async generateRefreshToken(sub: string, expiresIn: string = REFRESH_TOKEN_EXPIRES_IN) {
    try {
      const token = jwt.signRefreshToken(sub, expiresIn);

      return token.token;
    } catch (err) {
      throw Errors.Internal('RefreshToken 생성중 오류 발생: ', err);
    }
  }

  public async verifyRefreshToken(token: string): Promise<RefreshTokenPayload> {
    const payload = jwt.verifyRefreshTokenSignature(token);

    const tokenRevokedAt = await this.useAuthStore('토큰 블랙리스트 조회', () =>
      this.redisBlacklist.isOnBlacklist(payload.tokenId)
    );

    if (tokenRevokedAt !== null) {
      // 초 단위 통일
      const now = Math.floor(Date.now() / 1000);
      const passedTime = now - tokenRevokedAt;

      // 유예기간 판별(한 사용자의 같은 토큰을 이용한 다중요청 )
      if (passedTime > GRACE_PERIOD) {
        await this.revokeAllRefreshTokens(payload.sub);
        throw Errors.Unauthorized('비정상적인 접근 감지: 블랙리스트 등록된 토큰');
      }
    }

    if (payload.iat) {
      const userRevokedAt = await this.useAuthStore('사용자 무효화 정보 조회', () =>
        this.redisBlacklist.getUserAndRevokedAt(payload.sub)
      );

      if (userRevokedAt && userRevokedAt >= payload.iat!) {
        await this.revokeAllRefreshTokens(payload.sub);
        throw Errors.Unauthorized('비정상적인 접근 감지: 블랙리스트 유저 완전차단');
      }
    }

    return payload;
  }

  public async generateTokenPair(userUuid: string): Promise<TokenPair> {
    const accessToken = jwt.generateMainToken({ sub: userUuid });
    const refreshToken = await this.generateRefreshToken(userUuid);

    return {
      accessToken,
      refreshToken,
    };
  }

  /**
   
   */
  public async refreshAccessToken(refreshToken: string): Promise<TokenPair> {
    const payload = await this.verifyRefreshToken(refreshToken);
    const newTokenPair = await this.generateTokenPair(payload.sub);

    await this.revokeRefreshToken(refreshToken);

    return newTokenPair;
  }

  public async revokeRefreshToken(token: string): Promise<boolean> {
    const { sub, tokenId, role, exp, iat } = jwt.verifyRefreshTokenForRevoke(token);
    // 초단위 통일
    const now = Math.floor(Date.now() / 1000);
    if (!exp) return false;
    const expiresIn = exp - now;

    // 만료 토큰 처리
    if (expiresIn <= 0) {
      return false;
    }

    // 이미 블랙리스트에 등록된 토큰은 verifyRefreshToken에서 처리
    await this.useAuthStore('토큰 블랙리스트 기록', () =>
      this.redisBlacklist.addToBlacklist(tokenId, expiresIn, now.toString())
    );

    await this.useAuthStore('사용자 토큰 무효화 기록', () =>
      this.redisBlacklist.recordUserAndRevokedAt(sub, expiresIn, now.toString())
    );

    return true;
  }

  public async revokeAllRefreshTokens(userUuid: string): Promise<boolean> {
    // 초 단위 통일
    const now = Math.floor(Date.now() / 1000);

    await this.useAuthStore('사용자 토큰 무효화 기록', () =>
      this.redisBlacklist.recordUserAndRevokedAt(
        userUuid,
        toSeconds(REFRESH_TOKEN_EXPIRES_IN),
        now.toString()
      )
    );

    return true;
  }
}
