export type DateOnlyString = string;
export type DateOnlyInput = string | Date;

export function parseDateOnlyToUtcDate(value: DateOnlyInput): Date {
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new Error(`유효하지 않은 날짜입니다: ${value}`);
  }

  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function formatDateOnly(value: DateOnlyInput): DateOnlyString {
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

export function eachDateOnlyInRange(
  start: DateOnlyInput,
  end: DateOnlyInput
): DateOnlyString[] {
  const result: DateOnlyString[] = [];
  let current = formatDateOnly(start);
  const normalizedEnd = formatDateOnly(end);

  while (compareDateOnly(current, normalizedEnd) <= 0) {
    result.push(current);
    current = addDateOnlyDays(current, 1);
  }

  return result;
}
