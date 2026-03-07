// src/utils/timeConverter.ts
import { Errors } from './errors';

export function toSeconds(duration: string): number {
  const units: Record<string, number> = {
    s: 1,
    m: 60,
    h: 3600,
    d: 86400,
  };

  const match = duration.match(/^(\d+)([smhd])$/);
  if (!match) {
    throw Errors.Internal(`잘못된 시간 형식: ${duration}`);
  }

  const [, value, unit] = match;
  const numValue = parseInt(value, 10);

  if (numValue <= 0) {
    throw Errors.Internal(`시간 값은 양수여야 합니다: ${duration}`);
  }

  const seconds = numValue * units[unit];
  if (seconds > 365 * 86400) {
    throw Errors.Internal(`시간이 너무 깁니다: ${duration}`);
  }

  return seconds;
}
