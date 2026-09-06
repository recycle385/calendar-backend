export interface MainTokenPayload {
  sub: string; // user_uuid
  role: 'host';
}

export interface ParticipantTokenPayload {
  sub: string; // participant_uuid
  nickname: string;
  calendarSlug: string;
  /** @deprecated 기존 발급 토큰 호환용. 새 토큰은 calendarSlug를 사용한다. */
  calendarId?: string;
  role: 'host' | 'guest';

  userUuid?: string; // 선택적 사용자 UUID (연결된 사용자 있을 경우)
}

export interface RefreshTokenPayload {
  sub: string; // user_uuid
  tokenId: string;
  role: 'host';
  exp?: number;
  iat?: number;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}
