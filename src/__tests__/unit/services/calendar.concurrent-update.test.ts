import type { PoolConnection } from 'mysql2/promise';

import { Calendar } from '../../../models/Calendar';
import { ICalendarRepository } from '../../../repositories/calendar.repository';
import { IDateOptionRepository } from '../../../repositories/dateOption.repository';
import { IParticipantRepository } from '../../../repositories/participant.repository';
import { CalendarService } from '../../../services/calendar.service';
import { eachDateOnlyInRange } from '../../../utils/dateOnly';

jest.mock('../../../infrastructure/transaction.manager', () => {
  let tail = Promise.resolve();
  return {
    TransactionManager: {
      run: (callback: (connection: object) => Promise<unknown>) => {
        const next = tail.then(() => callback({ locked: true }));
        tail = next.then(
          () => undefined,
          () => undefined
        );
        return next;
      },
    },
  };
});

it('동시 기간 수정은 앞선 수정이 반영된 범위로 선택지를 구성하고 기존 범위의 투표를 보존한다', async () => {
  let state = {
    id: 1,
    owner_id: 1,
    slug: 'calendar',
    is_closed: false,
    start_date: '2026-09-01',
    end_date: '2026-09-10',
  } as Calendar;
  const dates = new Set(eachDateOnlyInRange(state.start_date, state.end_date));
  const votes = new Set(['2026-09-05']);
  const repository = {
    findBySlug: jest.fn(async () => ({ ...state })),
    findBySlugForUpdate: jest.fn(async (_slug: string, connection: PoolConnection) => {
      expect(connection).toEqual({ locked: true });
      return { ...state };
    }),
    update: jest.fn(async (_id, input) => {
      state = { ...state, ...input };
      return true;
    }),
    findById: jest.fn(async () => ({ ...state })),
  };
  const options = {
    deleteOutsideRange: jest.fn(async (_id, start, end) => {
      for (const date of dates) {
        if (date < start || date > end) {
          dates.delete(date);
          votes.delete(date);
        }
      }
      return 0;
    }),
    createBatch: jest.fn(async (_id, next: string[]) => {
      next.forEach((date) => dates.add(date));
      return next.length;
    }),
  };
  const service = new CalendarService(
    repository as unknown as ICalendarRepository,
    {} as IParticipantRepository,
    options as unknown as IDateOptionRepository
  );

  await Promise.all([
    service.updateCalendar('calendar', 1, { start_date: '2026-09-03' }),
    service.updateCalendar('calendar', 1, { end_date: '2026-09-08' }),
  ]);

  expect([...dates].sort()).toEqual(eachDateOnlyInRange('2026-09-03', '2026-09-08'));
  expect([...votes]).toEqual(['2026-09-05']);
  expect(repository.findBySlug).not.toHaveBeenCalled();
  expect(state).toMatchObject({ start_date: '2026-09-03', end_date: '2026-09-08' });
});
