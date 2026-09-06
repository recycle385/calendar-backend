import crypto, { randomUUID } from 'crypto';

import { env } from '../config/env';
import { CALENDAR_GRACE_PERIOD } from '../constants/calendar.constants';
import { TransactionManager } from '../infrastructure/transaction.manager';
import {
  Calendar,
  CalendarWithHostUuid,
  CreateCalendarInput,
  UpdateCalendarInput,
} from '../models/Calendar';
import { ICalendarRepository } from '../repositories/calendar.repository';
import { IDateOptionRepository } from '../repositories/dateOption.repository';
import { IParticipantRepository } from '../repositories/participant.repository';
import {
  addDateOnlyDays,
  compareDateOnly,
  daysBetweenDateOnly,
  eachDateOnlyInRange,
  formatDateOnly,
} from '../utils/dateOnly';
import { Errors } from '../utils/errors';

export interface ICalendarService {
  createCalendar(
    ownerId: number,
    title: string,
    startDate: string,
    endDate: string,
    hostNickname: string,
    description?: string
  ): Promise<{ calendar: Calendar; shareUrl: string; participantUuid: string }>;
  getCalendarBySlug(slug: string): Promise<Calendar>;
  getCalendarById(id: number): Promise<Calendar>;
  updateCalendar(slug: string, ownerId: number, input: UpdateCalendarInput): Promise<Calendar>;
  deleteCalendar(slug: string, ownerId: number): Promise<void>;
  closeCalendar(slug: string, ownerId: number): Promise<Calendar>;
  getUserCalendarsWithPUuids(ownerId: number): Promise<CalendarWithHostUuid[]>;
}

export class CalendarService implements ICalendarService {
  constructor(
    private calendarRepository: ICalendarRepository,
    private participantRepository: IParticipantRepository,
    private dateOptionRepository: IDateOptionRepository
  ) {}

  /**
   * 랜덤 slug 생성 (16자리 영문+숫자)
   */
  private generateSlug(): string {
    return crypto.randomBytes(8).toString('hex').substring(0, 16);
  }

  /**
   * 고유한 slug 생성 (중복 체크)
   */
  private async generateUniqueSlug(): Promise<string> {
    let slug: string;
    let attempts = 0;
    const maxAttempts = 10;

    do {
      slug = this.generateSlug();
      attempts++;

      if (attempts > maxAttempts) {
        throw new Error('고유한 slug 생성 실패');
      }
    } while (await this.calendarRepository.slugExists(slug));

    return slug;
  }

  /**
   * 날짜 유효성 검증
   */
  private validateDateRange(
    startDate: string,
    endDate: string
  ): { startDate: string; endDate: string } {
    let normalizedStart: string;
    let normalizedEnd: string;

    try {
      normalizedStart = formatDateOnly(startDate);
      normalizedEnd = formatDateOnly(endDate);
    } catch {
      throw Errors.BadRequest('유효하지 않은 날짜 형식입니다 (YYYY-MM-DD)');
    }

    // 시작일이 종료일보다 이후인 경우
    if (compareDateOnly(normalizedStart, normalizedEnd) > 0) {
      throw Errors.BadRequest('시작일은 종료일보다 이전이어야 합니다');
    }

    // 과거 날짜 체크 (선택사항 - 필요시 주석 해제)
    // if (compareDateOnly(normalizedStart, todayDateOnlyUtc()) < 0) {
    //   throw Errors.BadRequest('시작일은 오늘 이후여야 합니다');
    // }

    // 기간이 너무 긴 경우 (1년 이상)
    const diffDays = daysBetweenDateOnly(normalizedStart, normalizedEnd);
    if (diffDays > 365) {
      throw Errors.BadRequest('투표 기간은 최대 1년까지 가능합니다');
    }

    return { startDate: normalizedStart, endDate: normalizedEnd };
  }

  /**
   * 캘린더 생성 및 공유 링크 반환
   */
  async createCalendar(
    ownerId: number,
    title: string,
    startDate: string,
    endDate: string,
    hostNickname: string,
    description?: string
  ): Promise<{ calendar: Calendar; shareUrl: string; participantUuid: string }> {
    // 입력 검증
    if (!title || title.trim().length === 0) {
      throw Errors.BadRequest('캘린더 제목은 필수입니다');
    }

    if (title.length > 100) {
      throw Errors.BadRequest('캘린더 제목은 100자 이하여야 합니다');
    }

    const dateRange = this.validateDateRange(startDate, endDate);

    const expired_at = addDateOnlyDays(dateRange.endDate, CALENDAR_GRACE_PERIOD);

    // 고유한 slug 생성
    const slug = await this.generateUniqueSlug();
    return await TransactionManager.run(async (con) => {
      const input: CreateCalendarInput = {
        slug,
        title: title.trim(),
        description: description?.trim(),
        start_date: dateRange.startDate,
        end_date: dateRange.endDate,
        owner_id: ownerId,
        expired_at: expired_at,
      };

      const calendar = await this.calendarRepository.create(input, con);

      const dateList = eachDateOnlyInRange(dateRange.startDate, dateRange.endDate);

      await this.dateOptionRepository.createBatch(calendar.id, dateList, con);

      const participantUuid = randomUUID();

      await this.participantRepository.create(
        {
          participant_uuid: participantUuid,
          calendar_id: calendar.id,
          user_id: ownerId,
          role: 'host',
          nickname: hostNickname,
        },
        con
      );

      // 공유 URL 생성
      const shareUrl = `${env.CLIENT_URL || 'http://localhost:8080'}/calendar/${slug}`;

      return {
        calendar,
        shareUrl,
        participantUuid,
      };
    });
  }

  /**
   * Slug로 캘린더 조회
   */
  async getCalendarBySlug(slug: string): Promise<Calendar> {
    const calendar = await this.calendarRepository.findBySlug(slug);

    if (!calendar) {
      throw Errors.NotFound('캘린더를 찾을 수 없습니다');
    }

    return calendar;
  }

  /**
   * ID로 캘린더 조회
   */
  async getCalendarById(id: number): Promise<Calendar> {
    const calendar = await this.calendarRepository.findById(id);

    if (!calendar) {
      throw Errors.NotFound('캘린더를 찾을 수 없습니다');
    }

    return calendar;
  }

  async getIdUsingSlug(slug: string): Promise<number> {
    return await this.calendarRepository.getIdUsingSlug(slug);
  }

  async getUserCalendarsWithPUuids(ownerId: number): Promise<CalendarWithHostUuid[]> {
    return await this.calendarRepository.getCalAndPUuidDatasByUserIds(ownerId);
  }

  /**
   * 캘린더 정보 수정 (방장만 가능)
   */
  async updateCalendar(
    slug: string,
    ownerId: number,
    input: UpdateCalendarInput
  ): Promise<Calendar> {
    const calendar = await this.getCalendarBySlug(slug);

    // 권한 검증
    if (calendar.owner_id !== ownerId) {
      throw Errors.Forbidden('캘린더를 수정할 권한이 없습니다');
    }

    // 마감된 캘린더는 수정 불가
    if (calendar.is_closed) {
      throw Errors.BadRequest('마감된 캘린더는 수정할 수 없습니다');
    }

    const hasStartDate = input.start_date !== undefined;
    const hasEndDate = input.end_date !== undefined;
    const updateInput: UpdateCalendarInput = { ...input };
    let effectiveStartDate = calendar.start_date.toString();
    let effectiveEndDate = calendar.end_date.toString();

    // 날짜 범위 검증
    if (hasStartDate || hasEndDate) {
      const startDate = input.start_date || calendar.start_date;
      const endDate = input.end_date || calendar.end_date;
      const dateRange = this.validateDateRange(startDate.toString(), endDate.toString());
      effectiveStartDate = dateRange.startDate;
      effectiveEndDate = dateRange.endDate;

      if (hasStartDate) {
        updateInput.start_date = dateRange.startDate;
      }

      if (hasEndDate) {
        updateInput.end_date = dateRange.endDate;
        updateInput.expired_at = addDateOnlyDays(dateRange.endDate, CALENDAR_GRACE_PERIOD);
      }
    }

    const updated =
      hasStartDate || hasEndDate
        ? await TransactionManager.run(async (con) => {
            const isUpdated = await this.calendarRepository.update(calendar.id, updateInput, con);

            if (!isUpdated) {
              return false;
            }

            await this.dateOptionRepository.deleteOutsideRange(
              calendar.id,
              effectiveStartDate,
              effectiveEndDate,
              con
            );

            await this.dateOptionRepository.createBatch(
              calendar.id,
              eachDateOnlyInRange(effectiveStartDate, effectiveEndDate),
              con
            );

            return true;
          })
        : await this.calendarRepository.update(calendar.id, updateInput);

    if (!updated) {
      throw Errors.Internal('캘린더 수정에 실패했습니다');
    }

    return await this.getCalendarById(calendar.id);
  }

  /**
   * 캘린더 삭제 (방장만 가능)
   */
  async deleteCalendar(slug: string, ownerId: number): Promise<void> {
    const calendar = await this.getCalendarBySlug(slug);

    // 권한 검증
    if (calendar.owner_id !== ownerId) {
      throw Errors.Forbidden('캘린더를 삭제할 권한이 없습니다');
    }

    const deleted = await this.calendarRepository.delete(calendar.id);

    if (!deleted) {
      throw Errors.Internal('캘린더 삭제에 실패했습니다');
    }
  }

  /**
   * 캘린더 마감 (방장만 가능)
   */
  async closeCalendar(slug: string, ownerId: number): Promise<Calendar> {
    const calendar = await this.getCalendarBySlug(slug);

    // 권한 검증
    if (calendar.owner_id !== ownerId) {
      throw Errors.Forbidden('캘린더를 마감할 권한이 없습니다');
    }

    // 이미 마감된 경우
    if (calendar.is_closed) {
      throw Errors.BadRequest('이미 마감된 캘린더입니다');
    }

    const closed = await this.calendarRepository.close(calendar.id);

    if (!closed) {
      throw Errors.Internal('캘린더 마감에 실패했습니다');
    }

    return await this.getCalendarById(calendar.id);
  }
}
