/**
 * 회원(방장용) 테이블 타입 정의
 * DB: users
 */
export interface User {
  id: number;
  user_uuid: string;
  email: string;
  oauth_provider: 'google' | 'kakao';
  oauth_id: string;
  nickname: string;
  profile_image_url: string;
  isTermsAgreed: boolean;
  created_at: Date;
}

// INSERT용 타입 (id, timestamp 제외)
export interface CreateUserInput {
  user_uuid: string;
  email: string;
  oauth_provider: 'google' | 'kakao';
  oauth_id: string;
  nickname: string;
  profile_image_url: string;
  isTermsAgreed: boolean;
}

// UPDATE용 타입 (선택적)
export interface UpdateUserInput {
  nickname?: string;
  profile_image_url?: string;
}

// OAuth 검증용
export interface OAuthUser {
  oauth_provider: 'google' | 'kakao';
  oauth_id: string;
}
