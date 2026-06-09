import { DefaultResponseDto } from './common.dto';

export interface SafeDateInfoDto {
  locationDate: string; // 'YYYYMMDD' 형식의 문자열
  year: string; //4자리 연도 (예: '2025')
  seq: number; //날짜별 순번 (같은 날짜에 여러 기념일이 있을 수 있음)
  dateName: string;
  dateKind: '01' | '02' | '03' | '04' | '05';
  isHoliday: boolean;
  dataSource: 'public-api' | 'custom';
  updatedAt: Date;
}

export interface addDateInfoRequestDto {
  locationDate: string; // 'YYYYMMDD' 형식의 문자열
  year: string; //4자리 연도 (예: '2025')
  seq: number; //날짜별 순번 (같은 날짜에 여러 기념일이 있을 수 있음)
  dateName: string;
  dateKind: '01' | '02' | '03' | '04' | '05';
  isHoliday: boolean;
  dataSource: 'custom';
}

export interface addDateInfosRequestDto {
  dateInfos: addDateInfoRequestDto[];
}

export interface commonRequestDtoForYear {
  year: string; //4자리 연도 (예: '2025')
}

export interface commonRequestDtoForYears {
  years: string[]; //4자리 연도 배열 (예: ['2023', '2024', '2025'])
}

export interface commonRequestDtoForDateKinds {
  dateKinds: ('01' | '02' | '03' | '04' | '05')[];
}

export interface getDateInfosByYearResponseDto {
  dateInfos: SafeDateInfoDto[];
}

export interface commonDateInfoMapByYearResponseDto {
  [year: string]: SafeDateInfoDto[];
}

export interface getDateInfosByYearAndDateKindsRequestDto
  extends commonRequestDtoForYear,
    commonRequestDtoForDateKinds {}

export interface getDateInfosByYearsAndDateKindsRequestDto
  extends commonRequestDtoForYears,
    commonRequestDtoForDateKinds {}

export interface deleteByDatesAndNamesRequestDto {
  dateNamePairs: {
    locationDate: string; // 'YYYYMMDD' 형식의 문자열
    dateName: string;
  }[];
}
