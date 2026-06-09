export type DateOnlyString = string;
export type DateOnlyInput = string | Date;

const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const COMPACT_DATE_ONLY_PATTERN = /^(\d{4})(\d{2})(\d{2})$/;

function assertValidDateParts(year: number, month: number, day: number, originalValue: unknown) {
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() + 1 !== month ||
    date.getUTCDate() !== day
  ) {
    throw new Error(`유효하지 않은 날짜입니다: ${originalValue}`);
  }
}

export function normalizeDateOnly(value: unknown): DateOnlyString {
  if (typeof value !== 'string') {
    throw new Error('날짜는 YYYY-MM-DD 문자열이어야 합니다');
  }

  const trimmed = value.trim();
  const match = DATE_ONLY_PATTERN.exec(trimmed);

  if (!match) {
    throw new Error('날짜는 YYYY-MM-DD 형식이어야 합니다');
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  assertValidDateParts(year, month, day, value);

  return `${match[1]}-${match[2]}-${match[3]}`;
}

export function normalizeCompactDateOnly(value: unknown): DateOnlyString {
  if (typeof value !== 'string') {
    throw new Error('날짜는 YYYYMMDD 문자열이어야 합니다');
  }

  const trimmed = value.trim();
  const match = COMPACT_DATE_ONLY_PATTERN.exec(trimmed);

  if (!match) {
    throw new Error('날짜는 YYYYMMDD 형식이어야 합니다');
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  assertValidDateParts(year, month, day, value);

  return `${match[1]}-${match[2]}-${match[3]}`;
}

export function parseDateOnlyToUtcDate(value: DateOnlyInput): Date {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      throw new Error(`유효하지 않은 날짜입니다: ${value}`);
    }

    return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
  }

  const normalized = normalizeDateOnly(value);
  const [year, month, day] = normalized.split('-').map(Number);

  return new Date(Date.UTC(year, month - 1, day));
}

export function formatDateOnly(value: DateOnlyInput): DateOnlyString {
  if (typeof value === 'string') {
    return normalizeDateOnly(value);
  }

  const date = parseDateOnlyToUtcDate(value);

  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

export function addDateOnlyDays(value: DateOnlyInput, days: number): DateOnlyString {
  const date = parseDateOnlyToUtcDate(value);
  date.setUTCDate(date.getUTCDate() + days);
  return formatDateOnly(date);
}

export function compareDateOnly(left: DateOnlyInput, right: DateOnlyInput): number {
  const leftTime = parseDateOnlyToUtcDate(left).getTime();
  const rightTime = parseDateOnlyToUtcDate(right).getTime();

  return Math.sign(leftTime - rightTime);
}

export function daysBetweenDateOnly(start: DateOnlyInput, end: DateOnlyInput): number {
  const startTime = parseDateOnlyToUtcDate(start).getTime();
  const endTime = parseDateOnlyToUtcDate(end).getTime();

  return (endTime - startTime) / (1000 * 60 * 60 * 24);
}

export function todayDateOnlyUtc(now: Date = new Date()): DateOnlyString {
  return formatDateOnly(now);
}

export function eachDateOnlyInRange(start: DateOnlyInput, end: DateOnlyInput): DateOnlyString[] {
  const result: DateOnlyString[] = [];
  let current = formatDateOnly(start);
  const normalizedEnd = formatDateOnly(end);

  while (compareDateOnly(current, normalizedEnd) <= 0) {
    result.push(current);
    current = addDateOnlyDays(current, 1);
  }

  return result;
}
