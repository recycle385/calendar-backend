import {
  addDateOnlyDays,
  compareDateOnly,
  daysBetweenDateOnly,
  eachDateOnlyInRange,
  formatDateOnly,
  todayDateOnlyUtc,
} from '../../../utils/dateOnly';

describe('dateOnly util', () => {
  it('formatDateOnly는 타임존 오프셋이 있는 입력도 UTC 기준 YYYY-MM-DD로 정규화해야 한다', () => {
    expect(formatDateOnly('2026-04-28T00:30:00+09:00')).toBe('2026-04-27');
  });

  it('addDateOnlyDays는 계산 결과를 YYYY-MM-DD 문자열로 반환해야 한다', () => {
    expect(addDateOnlyDays('2026-04-28', 3)).toBe('2026-05-01');
  });

  it('compareDateOnly는 날짜 전용 값끼리 비교해야 한다', () => {
    expect(compareDateOnly('2026-04-28', '2026-04-29')).toBe(-1);
    expect(compareDateOnly('2026-04-28', '2026-04-28')).toBe(0);
    expect(compareDateOnly('2026-04-29', '2026-04-28')).toBe(1);
  });

  it('daysBetweenDateOnly는 UTC 날짜 경계 기준 차이를 반환해야 한다', () => {
    expect(daysBetweenDateOnly('2026-04-28', '2026-05-01')).toBe(3);
  });

  it('eachDateOnlyInRange는 시작일과 종료일을 포함한 YYYY-MM-DD 목록을 반환해야 한다', () => {
    expect(eachDateOnlyInRange('2026-04-28', '2026-05-01')).toEqual([
      '2026-04-28',
      '2026-04-29',
      '2026-04-30',
      '2026-05-01',
    ]);
  });

  it('todayDateOnlyUtc는 주어진 시각의 UTC 날짜 문자열을 반환해야 한다', () => {
    expect(todayDateOnlyUtc(new Date('2026-04-28T23:30:00.000Z'))).toBe('2026-04-28');
  });
});
