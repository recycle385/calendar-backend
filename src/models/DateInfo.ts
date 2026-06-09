export const VALID_DATE_KINDS = ['01', '02', '03', '04', '05'] as const; //01: 휴일(빨간 날), 02: 국경일, 03: 기념일, 04: 24절기, 05: 잡절
export type DateKind = (typeof VALID_DATE_KINDS)[number];

export type DataSource = 'public-api' | 'custom';

export const dateKindMap = new Map<DateKind, string>([
  ['01', 'getRestDeInfo'], // 휴일 (빨간 날)
  ['02', 'getHoliDeInfo'], // 국경일 (삼일절, 광복절 등)
  ['03', 'getAnniversaryInfo'], // 기념일 (어버이날, 스승의날 등)
  ['04', 'get24DivisionsInfo'], // 24절기 (입춘, 동지 등)
  ['05', 'getSundryDayInfo'], // 잡절
]);

/**
 * 기념일 정보 DTO
 */
export interface DateInfo {
  id: number;
  locationDate: Date;
  year: string; //4자리 연도 (예: '2025')
  seq: number; //날짜별 순번 (같은 날짜에 여러 기념일이 있을 수 있음)
  dateName: string;
  dateKind: DateKind;
  isHoliday: boolean;
  dataSource: DataSource;
  updatedAt: Date;
}

/**
 * 외부에서 입력받는 데이터 형식
 */
export interface SafeDateInfo {
  locationDate: Date;
  year: string; //4자리 연도 (예: '2025')
  seq: number; //날짜별 순번 (같은 날짜에 여러 기념일이 있을 수 있음)
  dateName: string;
  dateKind: DateKind;
  isHoliday: boolean;
  dataSource: DataSource;
}

export interface SafeDateInfoForResponse {
  locationDate: string; // 'YYYYMMDD' 형식의 문자열
  year: string; //4자리 연도 (예: '2025')
  seq: number; //날짜별 순번 (같은 날짜에 여러 기념일이 있을 수 있음)
  dateName: string;
  dateKind: DateKind;
  isHoliday: boolean;
  dataSource: DataSource;
  updatedAt: Date;
}

export interface SpcdeItem {
  locdate: number;
  seq: number;
  dateName: string;
  dateKind: string;
  isHoliday: 'Y' | 'N';
}

export interface DateInfoMapByYear {
  [year: string]: SafeDateInfoForResponse[];
}

export interface DateNamePair {
  locationDate: Date;
  dateName: string;
}
