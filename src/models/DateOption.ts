/**
 * 날짜 옵션 테이블 타입 정의
 * DB: date_options
 */
export interface DateOption {
  id: number;
  calendar_id: number;
  date_value: Date; // DATE 타입 (시간 없음)
  is_enabled: boolean;
  created_at: Date;
}

// INSERT용
export interface CreateDateOptionInput {
  calendar_id: number;
  date_value: Date | string; // '2025-10-15' 형식 허용
  is_enabled?: boolean;
}

// 날짜 활성화/비활성화
export interface UpdateDateOptionInput {
  is_enabled: boolean;
}

// 투표 집계 포함한 날짜 정보
export interface DateOptionWithSummary extends DateOption {
  summary: {
    total_participants: number;
    voted_count: number;
    available_count: number;
    unavailable_count: number;
    maybe_count: number;
    vote_rate: number; // 투표율 계산
  };
}
