/**
 * 투표 집계 캐시 테이블 타입 정의 (임시 나중에 수정 필요)
 * DB: vote_summary
 */
export interface VoteSummary {
  id: number;
  date_option_id: number;
  total_participants: number; // 전체 참가자 수
  voted_count: number; // 실제 투표한 사람 수
  available_count: number;
  unavailable_count: number;
  maybe_count: number;
  updated_at: Date;
}

// 계산된 필드 포함
export interface VoteSummaryWithRate extends VoteSummary {
  vote_rate: number; // 투표율 (%)
  best_option: boolean; // 최다 득표 여부
}

// 날짜별 집계 조회용
export interface DateSummary {
  date_value: Date;
  is_enabled: boolean;
  summary: VoteSummary;
  vote_rate: number;
}
