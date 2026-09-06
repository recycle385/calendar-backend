import { describe, expect, it } from '@jest/globals';

import {
  addUtcDays,
  formatUtcDateOnly,
  formatUtcDateTimeForSql,
  parseUtcDateOnly,
  startOfUtcToday,
} from '../../../utils/utcDate';

describe('utcDate util', () => {
  it('parseUtcDateOnly는 YYYY-MM-DD만 UTC 날짜 자정으로 정규화해야 한다', () => {
    const normalized = parseUtcDateOnly('2026-04-28');

    expect(normalized.toISOString()).toBe('2026-04-28T00:00:00.000Z');
    expect(() => parseUtcDateOnly('2026-04-28T00:30:00+09:00')).toThrow(
      '날짜는 YYYY-MM-DD 형식이어야 합니다'
    );
  });

  it('formatUtcDateOnly는 UTC 기준 YYYY-MM-DD 문자열을 반환해야 한다', () => {
    expect(formatUtcDateOnly('2026-04-28')).toBe('2026-04-28');
  });

  it('addUtcDays는 날짜 경계를 UTC 기준으로 이동해야 한다', () => {
    const result = addUtcDays('2026-04-28', 3);

    expect(result.toISOString()).toBe('2026-05-01T00:00:00.000Z');
  });

  it('startOfUtcToday는 UTC 자정이어야 한다', () => {
    const today = startOfUtcToday();

    expect(today.getUTCHours()).toBe(0);
    expect(today.getUTCMinutes()).toBe(0);
    expect(today.getUTCSeconds()).toBe(0);
  });

  it('formatUtcDateTimeForSql은 DB 비교용 UTC datetime 문자열을 반환해야 한다', () => {
    expect(formatUtcDateTimeForSql('2026-04-28T00:30:15+09:00')).toBe('2026-04-27 15:30:15');
  });
});
