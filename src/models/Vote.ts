/**
 * 투표 테이블 타입 정의
 * DB: votes
 */
export type VoteType = 'available' | 'unavailable' | 'maybe';

export interface Vote {
  id: number;
  participant_id: number;
  date_option_id: number;
  vote_type: VoteType;
  created_at: Date;
  updated_at: Date;
}

// INSERT/UPDATE용
export interface CreateVoteInput {
  participant_id: number;
  date_option_id: number;
  vote_type: VoteType;
}

export interface UpdateVoteInput {
  vote_type: VoteType;
}

// 참가자별 투표 현황 조회용
export interface VoteWithDetails extends Vote {
  participant: {
    id: number;
    nickname: string;
    color_code: string;
  };
  date_option: {
    id: number;
    date_value: string;
  };
}

// 날짜별 투표 현황 (그리드 표시용)
export interface DateVoteStatus {
  date_option_id: number;
  date_value: string;
  is_enabled: boolean;
  votes: {
    participant_id: number;
    participant_nickname: string;
    participant_color: string;
    vote_type: VoteType;
  }[];
}

export interface VoteRecordForParticipant
  extends Omit<Vote, 'id' | 'participant_id' | 'date_option_id' | 'updated_at'> {
  vote_id: number;
  date_value: string;
}
