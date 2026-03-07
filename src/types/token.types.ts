import { GoogleProfileData } from './auth.types';

export interface MainTokenPayload {
  sub: string; // user_uuid
  role: 'host';
}

export interface ParticipantTokenPayload {
  sub: string; // participant_uuid
  nickname: string;
  calendarId: string; //slug
  role: 'host' | 'guest';

  userUuid?: string; // 선택적 사용자 UUID (연결된 사용자 있을 경우)
}

export interface SignupTokenPayload {
  googleProfile: GoogleProfileData;
}

export interface RefreshTokenPayload {
  sub: string; // user_uuid
  tokenId: string;
  role: 'host';
  exp?: number;
  iat?: number;
}

// 나중에 utils/jwt 토큰 제네릭으로 통합 예정
export type TokenPayload =
  | MainTokenPayload
  | ParticipantTokenPayload
  | SignupTokenPayload
  | RefreshTokenPayload;

export type UserTokenPayload = MainTokenPayload | ParticipantTokenPayload;

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface IRedisBlacklistRepository {
  isOnBlacklist(tokenId: string): Promise<number | null>;
  addToBlacklist(tokenId: string, expiresIn: number, revokedAt: string): Promise<void>;
  recordUserAndRevokedAt(userId: string, expiresIn: number, revokedAt: string): Promise<void>;
  getUserAndRevokedAt(userId: string): Promise<number | null>;
}

export interface ITokenService {
  verifySignupToken(token: string): SignupTokenPayload;
  generateMainToken(payload: MainTokenPayload, expiresIn?: string): string;
  verifyMainToken(token: string): MainTokenPayload;
  verifyUserToken(token: string): UserTokenPayload;

  generateParticipantToken(payload: ParticipantTokenPayload, expiresIn?: string): string;
  verifyParticipantToken(token: string): ParticipantTokenPayload;

  generateSignupToken(payload: SignupTokenPayload, expiresIn?: string): string;
  generateRefreshToken(sub: string, expiresIn?: string): Promise<string>;
  verifyRefreshToken(token: string): Promise<RefreshTokenPayload>;
  generateTokenPair(userUuid: string): Promise<TokenPair>;
  refreshAccessToken(refreshToken: string): Promise<TokenPair>;
  revokeRefreshToken(token: string): Promise<boolean>;
  revokeAllRefreshTokens(userUuid: string): Promise<boolean>;
}
