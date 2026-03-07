// User
export * from './User';

// Calendar
export * from './Calendar';

// Participant
export * from './Participant';

// DateOption
export * from './DateOption';

// Vote
export * from './Vote';

// VoteSummary
export * from './VoteSummary';

// 공통 응답 타입
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  meta: PaginationMeta;
}
