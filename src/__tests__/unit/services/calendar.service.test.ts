/// <reference types="jest" />

import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import { Calendar } from '../../../models/Calendar';
import { ICalendarRepository } from '../../../repositories/calendar.repository';
import { IDateOptionRepository } from '../../../repositories/dateOption.repository';
import { IParticipantRepository } from '../../../repositories/participant.repository';
import { CalendarService } from '../../../services/calendar.service';
import { Errors } from '../../../utils/errors';

// TransactionManager Mocking
jest.mock('../../../infrastructure/transaction.manager', () => ({
  TransactionManager: {
    run: jest.fn((callback: (connection: object) => unknown) => callback({})), // 콜백을 즉시 실행
  },
}));

// Dependencies Mocking
const mockCalendarRepository: jest.Mocked<ICalendarRepository> = {
  create: jest.fn(),
  findById: jest.fn(),
  findBySlug: jest.fn(),
  findByOwnerId: jest.fn(),
  getIdUsingSlug: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  deleteByIds: jest.fn(),
  close: jest.fn(),
  closeByIds: jest.fn(),
  getCalAndPUuidDatasByUserIds: jest.fn(),
  slugExists: jest.fn(),
  findEndedAndOpen: jest.fn(),
  findExpired: jest.fn(),
};

const mockParticipantRepository: jest.Mocked<IParticipantRepository> = {
  create: jest.fn(),
  findById: jest.fn(),
  findByUuid: jest.fn(),
  existsByUuid: jest.fn(),
  getIdUsingUuid: jest.fn(),
  getUuidUsingId: jest.fn(),
  getParticipantUuidByUserIdAndCalendarId: jest.fn(),
  findUserGuestById: jest.fn(),
  findByCalendarAndNickname: jest.fn(),
  findAllByCalendarId: jest.fn(),
  findAllByCalendarIdWithVotes: jest.fn(),
  nicknameExists: jest.fn(),
  delete: jest.fn(),
};

const mockDateOptionRepository: jest.Mocked<IDateOptionRepository> = {
  create: jest.fn(),
  createBatch: jest.fn(),
  findById: jest.fn(),
  findOptionsByIds: jest.fn(),
  findByCalendarId: jest.fn(),
  findDateOptionsByCalendarAndDate: jest.fn(),
  findByCalendarAndDate: jest.fn(),
  delete: jest.fn(),
  deleteByCalendarId: jest.fn(),
};

describe('CalendarService Unit Test', () => {
  let calendarService: CalendarService;

  beforeEach(() => {
    jest.clearAllMocks();
    calendarService = new CalendarService(
      mockCalendarRepository,
      mockParticipantRepository,
      mockDateOptionRepository
    );
  });

  // =================================================================
  // 1. 캘린더 생성 (createCalendar)
  // =================================================================
  describe('createCalendar', () => {
    const ownerId = 1;
    const title = 'Test Calendar';
    const startDate = '2025-01-01';
    const endDate = '2025-01-03'; // 3일간
    const hostNickname = 'HostUser';
    const description = 'Description';

    it('[성공] 정상적인 입력값으로 캘린더, DateOption, 방장 참가자가 생성되어야 한다', async () => {
      // Mock 설정
      mockCalendarRepository.slugExists.mockResolvedValue(false); // slug 중복 없음
      mockCalendarRepository.create.mockResolvedValue({
        id: 1,
        slug: 'test-slug',
      } as Calendar); // 캘린더 생성 성공 시 반환값
      mockParticipantRepository.create.mockResolvedValue({} as any); // 참가자 생성 성공

      // 실행
      const result = await calendarService.createCalendar(
        ownerId,
        title,
        startDate,
        endDate,
        hostNickname,
        description
      );

      // 검증: 캘린더 생성 호출 확인
      expect(mockCalendarRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          title,
          start_date: startDate,
          end_date: endDate,
          owner_id: ownerId,
          description,
        }),
        expect.anything()
      );

      // 검증: DateOption 배치 생성 호출 확인 (1/1, 1/2, 1/3 -> 3개)
      expect(mockDateOptionRepository.createBatch).toHaveBeenCalledWith(
        1, // calendarId
        ['2025-01-01', '2025-01-02', '2025-01-03'], // 날짜 리스트
        expect.anything()
      );

      // 검증: 방장 참가자 생성 호출 확인
      expect(mockParticipantRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          calendar_id: 1,
          user_id: ownerId,
          role: 'host',
          nickname: hostNickname,
        }),
        expect.anything()
      );

      // 검증: 반환값 구조
      expect(result).toHaveProperty('calendar');
      expect(result).toHaveProperty('shareUrl');
      expect(result).toHaveProperty('participantUuid');
    });

    it('[실패] 시작일이 종료일보다 늦은 경우 에러를 던져야 한다', async () => {
      await expect(
        calendarService.createCalendar(
          ownerId,
          title,
          '2025-01-05', // 시작일
          '2025-01-01', // 종료일
          hostNickname
        )
      ).rejects.toThrow('시작일은 종료일보다 이전이어야 합니다');
    });

    it('[실패] 기간이 1년(365일)을 초과하는 경우 에러를 던져야 한다', async () => {
      await expect(
        calendarService.createCalendar(
          ownerId,
          title,
          '2025-01-01',
          '2026-02-01', // 1년 초과
          hostNickname
        )
      ).rejects.toThrow('투표 기간은 최대 1년까지 가능합니다');
    });

    it('[실패] 날짜 형식이 잘못된 경우 에러를 던져야 한다', async () => {
      await expect(
        calendarService.createCalendar(ownerId, title, 'invalid-date', '2025-01-01', hostNickname)
      ).rejects.toThrow('유효하지 않은 날짜 형식입니다');
    });

    it('[실패] 날짜 전용 필드에 datetime이 들어오면 거부해야 한다', async () => {
      await expect(
        calendarService.createCalendar(
          ownerId,
          title,
          '2026-04-28T00:30:00+09:00',
          '2026-04-30T00:30:00+09:00',
          hostNickname,
          description
        )
      ).rejects.toThrow('유효하지 않은 날짜 형식입니다');
    });

    it('[실패] Slug 생성 충돌 시 재시도 로직이 동작해야 한다', async () => {
      // 첫 번째 호출 시 true(충돌), 두 번째 false(성공) 반환
      mockCalendarRepository.slugExists.mockResolvedValueOnce(true).mockResolvedValueOnce(false);

      mockCalendarRepository.create.mockResolvedValue({ id: 1 } as Calendar);

      await calendarService.createCalendar(ownerId, title, startDate, endDate, hostNickname);

      // slugExists가 두 번 호출되었는지 확인
      expect(mockCalendarRepository.slugExists).toHaveBeenCalledTimes(2);
    });
  });

  // =================================================================
  // 2. 캘린더 조회 (getCalendarBySlug)
  // =================================================================
  describe('getCalendarBySlug', () => {
    const slug = 'test-slug';

    it('[성공] 존재하는 Slug로 조회 시 Calendar 객체를 반환해야 한다', async () => {
      const mockCalendar = { id: 1, slug, title: 'Found' } as Calendar;
      mockCalendarRepository.findBySlug.mockResolvedValue(mockCalendar);

      const result = await calendarService.getCalendarBySlug(slug);

      expect(mockCalendarRepository.findBySlug).toHaveBeenCalledWith(slug);
      expect(result).toEqual(mockCalendar);
    });

    it('[실패] 존재하지 않는 Slug 조회 시 NotFound 에러를 던져야 한다', async () => {
      mockCalendarRepository.findBySlug.mockResolvedValue(null);

      await expect(calendarService.getCalendarBySlug('unknown')).rejects.toThrow(
        Errors.NotFound('캘린더를 찾을 수 없습니다')
      );
    });
  });

  // =================================================================
  // 3. 캘린더 수정 (updateCalendar)
  // =================================================================
  describe('updateCalendar', () => {
    const slug = 'test-slug';
    const ownerId = 1;
    const otherUserId = 999;
    const existingCalendar = {
      id: 1,
      slug,
      owner_id: ownerId,
      title: 'Old Title',
      start_date: '2025-01-01',
      end_date: '2025-01-03',
      is_closed: false,
    } as Calendar;

    it('[성공] 방장 권한으로 제목/설명/날짜 수정 시 성공해야 한다', async () => {
      mockCalendarRepository.findBySlug.mockResolvedValue(existingCalendar);
      mockCalendarRepository.update.mockResolvedValue(true);
      mockCalendarRepository.findById.mockResolvedValue({
        ...existingCalendar,
        title: 'New Title',
      } as Calendar);

      const updateInput = { title: 'New Title' };
      const result = await calendarService.updateCalendar(slug, ownerId, updateInput);

      expect(mockCalendarRepository.update).toHaveBeenCalledWith(existingCalendar.id, updateInput);
      expect(result.title).toBe('New Title');
    });

    it('[실패] 방장이 아닌 사용자가 수정 시도 시 Forbidden 에러를 던져야 한다', async () => {
      mockCalendarRepository.findBySlug.mockResolvedValue(existingCalendar);

      await expect(
        calendarService.updateCalendar(slug, otherUserId, { title: 'New' })
      ).rejects.toThrow('캘린더를 수정할 권한이 없습니다');
    });

    it('[실패] 이미 마감된(is_closed) 캘린더 수정 시도 시 BadRequest 에러를 던져야 한다', async () => {
      const closedCalendar = { ...existingCalendar, is_closed: true };
      mockCalendarRepository.findBySlug.mockResolvedValue(closedCalendar);

      await expect(calendarService.updateCalendar(slug, ownerId, { title: 'New' })).rejects.toThrow(
        '마감된 캘린더는 수정할 수 없습니다'
      );
    });

    it('[로직] 종료일 수정 시 expired_at (만료일)이 자동 연장되어야 한다', async () => {
      mockCalendarRepository.findBySlug.mockResolvedValue(existingCalendar);
      mockCalendarRepository.update.mockResolvedValue(true);
      mockCalendarRepository.findById.mockResolvedValue(existingCalendar);

      const newEndDate = '2025-02-01';
      await calendarService.updateCalendar(slug, ownerId, { end_date: newEndDate });

      // 예상 만료일 계산: 종료일 + GRACE_PERIOD
      // 날짜 계산은 service 내부 로직(addDate)과 동일하게 추론
      // service 내부: expired_at = this.addDate(input.end_date, CALENDAR_GRACE_PERIOD);
      // 여기서는 update 메서드의 호출 인자 중 expired_at이 포함되어 있는지 검증

      expect(mockCalendarRepository.update).toHaveBeenCalledWith(
        existingCalendar.id,
        expect.objectContaining({
          end_date: newEndDate,
          expired_at: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/), // 날짜 형식 문자열 확인
        })
      );
    });
  });

  // =================================================================
  // 4. 캘린더 마감/삭제 (closeCalendar / deleteCalendar)
  // =================================================================
  describe('closeCalendar & deleteCalendar', () => {
    const slug = 'test-slug';
    const ownerId = 1;
    const otherUserId = 999;
    const targetCalendar = {
      id: 1,
      slug,
      owner_id: ownerId,
      is_closed: false,
    } as Calendar;

    // --- Close ---
    it('[성공] 방장에 의한 캘린더 마감 성공', async () => {
      mockCalendarRepository.findBySlug.mockResolvedValue(targetCalendar);
      mockCalendarRepository.close.mockResolvedValue(true);
      mockCalendarRepository.findById.mockResolvedValue({
        ...targetCalendar,
        is_closed: true,
      } as Calendar);

      const result = await calendarService.closeCalendar(slug, ownerId);

      expect(mockCalendarRepository.close).toHaveBeenCalledWith(targetCalendar.id);
      expect(result.is_closed).toBe(true);
    });

    it('[실패] 권한 없는 유저의 마감 요청 시 Forbidden 에러', async () => {
      mockCalendarRepository.findBySlug.mockResolvedValue(targetCalendar);

      await expect(calendarService.closeCalendar(slug, otherUserId)).rejects.toThrow(
        '캘린더를 마감할 권한이 없습니다'
      );
    });

    // --- Delete ---
    it('[성공] 방장에 의한 캘린더 삭제 성공', async () => {
      mockCalendarRepository.findBySlug.mockResolvedValue(targetCalendar);
      mockCalendarRepository.delete.mockResolvedValue(true);

      await calendarService.deleteCalendar(slug, ownerId);

      expect(mockCalendarRepository.delete).toHaveBeenCalledWith(targetCalendar.id);
    });

    it('[실패] 권한 없는 유저의 삭제 요청 시 Forbidden 에러', async () => {
      mockCalendarRepository.findBySlug.mockResolvedValue(targetCalendar);

      await expect(calendarService.deleteCalendar(slug, otherUserId)).rejects.toThrow(
        '캘린더를 삭제할 권한이 없습니다'
      );
    });
  });
});
