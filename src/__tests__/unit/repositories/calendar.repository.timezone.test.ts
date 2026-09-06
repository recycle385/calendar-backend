import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import { CalendarRepository } from '../../../repositories/calendar.repository';

describe('CalendarRepository UTC 기준 조회', () => {
  let mockPool: { execute: jest.MockedFunction<(...args: unknown[]) => Promise<unknown>> };
  let repository: CalendarRepository;

  beforeEach(() => {
    mockPool = {
      execute: jest.fn(async () => [[]]),
    };
    repository = new CalendarRepository(mockPool as any);
  });

  it('findEndedAndOpen은 DB CURDATE 대신 UTC 날짜 파라미터를 사용해야 한다', async () => {
    await repository.findEndedAndOpen(undefined, new Date('2026-06-08T23:30:00.000Z'));

    expect(mockPool.execute).toHaveBeenCalledWith(
      'SELECT * FROM calendars WHERE is_closed = FALSE AND end_date < ?',
      ['2026-06-08']
    );
  });

  it('findExpired는 DB NOW 대신 UTC datetime 파라미터를 사용해야 한다', async () => {
    await repository.findExpired(undefined, new Date('2026-06-08T23:30:15.000Z'));

    expect(mockPool.execute).toHaveBeenCalledWith('SELECT * FROM calendars WHERE expired_at < ?', [
      '2026-06-08 23:30:15',
    ]);
  });

  it('DATE 컬럼은 Date 객체가 아니라 YYYY-MM-DD 문자열로 매핑해야 한다', async () => {
    mockPool.execute.mockImplementationOnce(async () => [
      [
        {
          id: 1,
          slug: 'slug',
          title: 'title',
          description: null,
          start_date: '2026-06-08',
          end_date: '2026-06-10',
          is_closed: 0,
          owner_id: 1,
          created_at: '2026-06-01 00:00:00',
          expired_at: '2026-07-10 00:00:00',
        },
      ],
    ]);

    const calendar = await repository.findById(1);

    expect(calendar?.start_date).toBe('2026-06-08');
    expect(calendar?.end_date).toBe('2026-06-10');
  });
});
