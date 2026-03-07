import { GoogleProfileData } from '../../types/auth.types';
import { RefreshTokenPayload } from '../../types/token.types';
import { Errors } from '../errors';

//유효 검증
export function validateDecodedToken(decoded: unknown): asserts decoded is Record<string, unknown> {
  if (typeof decoded !== 'object' || decoded === null || Array.isArray(decoded)) {
    throw Errors.Unauthorized('유효하지 않은 토큰 페이로드입니다');
  }
}

//역할 검증
export function validateRole(
  decoded: Record<string, unknown>,
  expectedRole: 'host' | 'guest'
): void {
  if (!('role' in decoded) || decoded.role !== expectedRole) {
    throw Errors.Unauthorized(
      `잘못된 토큰 권한입니다. (필요: ${expectedRole}, 수신: ${decoded.role ?? '없음'})`
    );
  }
}

export function isGoogleProfileData(obj: unknown): obj is GoogleProfileData {
  if (typeof obj !== 'object' || obj === null) return false;

  return (
    'oauth_id' in obj &&
    typeof obj.oauth_id === 'string' &&
    'email' in obj &&
    typeof obj.email === 'string' &&
    'name' in obj &&
    typeof obj.name === 'string' &&
    'picture' in obj &&
    typeof obj.picture === 'string'
  );
}

//속성 추출 메서드
export const extractProperty = {
  get(decoded: Record<string, unknown>, key: string): unknown {
    if (!(key in decoded)) {
      throw Errors.Unauthorized(`토큰 페이로드에 필수 속성(${key})이 없습니다`);
    }
    return decoded[key];
  },

  //키 문자열 추출 및 null 체크
  string(decoded: Record<string, unknown>, key: string, propertyName: string): string {
    const value = this.get(decoded, key);

    if (typeof value !== 'string' || value.trim().length === 0) {
      throw Errors.Unauthorized(`${propertyName}(${key})이(가) 토큰에 없거나 유효하지 않습니다`);
    }
    return value;
  },

  //키 문자열 추출 및 null 체크
  nullableString(
    decoded: Record<string, unknown>,
    key: string,
    fieldName: string
  ): string | undefined {
    // key가 없거나 undefined/null이면 undefined 반환
    if (!(key in decoded) || decoded[key] === undefined || decoded[key] === null) {
      return undefined;
    }

    const value = decoded[key];
    if (typeof value !== 'string') {
      throw Errors.Unauthorized(`${fieldName}(${key})의 타입이 올바르지 않습니다`);
    }
    return value;
  },

  number(decoded: Record<string, unknown>, key: string, propertyName: string): number {
    const value = this.get(decoded, key);

    if (typeof value !== 'number' || isNaN(value)) {
      throw Errors.Unauthorized(`${propertyName}(${key})이(가) 토큰에 없거나 유효하지 않습니다`);
    }
    return value;
  },

  role(decoded: Record<string, unknown>, key: string, propertyName: string): 'host' | 'guest' {
    const value = this.get(decoded, key);

    if (value !== 'host' && value !== 'guest') {
      throw Errors.Unauthorized(`${propertyName}(${key})이(가) 토큰에 없거나 유효하지 않습니다`);
    }
    return value;
  },
};

export function isRefreshToken(payload: unknown): payload is RefreshTokenPayload {
  return (
    typeof payload === 'object' &&
    payload !== null &&
    !Array.isArray(payload) &&
    'tokenId' in payload &&
    'sub' in payload &&
    'role' in payload &&
    typeof (payload as RefreshTokenPayload).tokenId === 'string' &&
    typeof (payload as RefreshTokenPayload).sub === 'string' &&
    (payload as RefreshTokenPayload).role === 'host'
  );
}
