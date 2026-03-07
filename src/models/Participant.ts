/**
 * 참가자 테이블 타입 정의
 * DB: participants
 * 모든 호스트와 게스트는 참가자를 의미함, 참가자가 호스트와 게스트의 상위 개념임.
 */
export interface Participant {
  id: number;
  participant_uuid: string; // UUID
  user_id: number | null; // users.id (비회원일 경우 NULL)
  role: 'host' | 'guest';
  calendar_id: number;
  nickname: string;
  password_hash: string | null; // bcrypt 해시
  color_code: string; // hex 색상 (기본값: #FF0000)
  joined_at: Date;
}

interface BaseParticipantInput {
  participant_uuid: string;
  calendar_id: number;
  nickname: string;
  color_code?: string; // 기본값: #FF0000
}

export interface HostParticipantInput extends BaseParticipantInput {
  role: 'host';
  user_id: number;
  password_hash?: never;
}

export interface UserGuestParticipantInput extends BaseParticipantInput {
  role: 'guest';
  user_id: number;
  password_hash?: never;
}

export interface GuestParticipantInput extends BaseParticipantInput {
  role: 'guest';
  user_id?: never;
  password_hash: string;
}

// INSERT용
export type CreateParticipantInput =
  | HostParticipantInput
  | UserGuestParticipantInput
  | GuestParticipantInput;

export type ParticipantServiceInput =
  | {
      userId: number;
      calendarId: number;
      nickname: string;
      role?: 'host' | 'guest';
    }
  | {
      password: string;
      calendarId: number;
      nickname: string;
      role?: 'host' | 'guest';
      userId?: never;
    };

// 로그인용 (비밀번호 검증)
export interface ParticipantLoginInput {
  calendar_id: number;
  nickname: string;
  password: string; // 평문 비밀번호 (검증용)
}

// 닉네임 중복 체크용
export interface ParticipantCheckInput {
  calendar_id: number;
  nickname: string;
}

// 참가자 목록 조회용 (투표 현황 포함)
export interface ParticipantWithVotes extends Participant {
  vote_count: number; // 투표한 날짜 수
  total_dates: number; // 전체 날짜 수
  vote_rate: number; // 투표율 (%)
}
