import { User } from '../models';
import { TokenPair } from './token.types';

export interface GoogleTokens {
  access_token: string;
  id_token: string;
}

export interface GoogleProfileOriginData {
  sub: string;
  email: string;
  name: string;
  picture: string;
}

export interface GoogleProfileData {
  oauth_id: string;
  email: string;
  name: string;
  picture: string;
}

export interface ExistingUserResponse {
  type: 'existingUser';
  token: TokenPair;
  user: User;
}

export interface NewUserCallbackSignupResponse {
  type: 'pendingSignup';
  signupToken: string;
}

export interface NewUserImmediateSignupResponse {
  type: 'immediateSignup';
  token: TokenPair;
  user: User;
}

export type OAuthCallbackResponse =
  | ExistingUserResponse
  | NewUserCallbackSignupResponse
  | NewUserImmediateSignupResponse;

export interface SafeUser {
  user_uuid: string;
  email: string;
  oauth_provider: 'google' | 'kakao';
  nickname: string;
  profile_image_url: string;
  isTermsAgreed: boolean;
  created_at: Date;
}
