import crypto from 'crypto';
import { randomUUID } from 'crypto';

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
  getUserCalendars(ownerId: number): Promise<Calendar[]>;
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
  private validateDateRange(startDate: string, endDate: string): void {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 날짜 형식 검증
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw Errors.BadRequest('유효하지 않은 날짜 형식입니다 (YYYY-MM-DD)');
    }

    // 시작일이 종료일보다 이후인 경우
    if (start > end) {
      throw Errors.BadRequest('시작일은 종료일보다 이전이어야 합니다');
    }

    // 과거 날짜 체크 (선택사항 - 필요시 주석 해제)
    // if (start < today) {
    //   throw Errors.BadRequest('시작일은 오늘 이후여야 합니다');
    // }

    // 기간이 너무 긴 경우 (1년 이상)
    const diffDays = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
    if (diffDays > 365) {
      throw Errors.BadRequest('투표 기간은 최대 1년까지 가능합니다');
    }
  }

  private addDate(baseDate: string | Date, datesToAdd: number): string {
    const targetDate = new Date(baseDate);

    targetDate.setDate(targetDate.getDate() + datesToAdd);

    const year = targetDate.getFullYear();
    const month = String(targetDate.getMonth() + 1).padStart(2, '0'); // 월은 0부터 시작하므로 +1
    const day = String(targetDate.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
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

    this.validateDateRange(startDate, endDate);

    const expired_at = this.addDate(endDate, CALENDAR_GRACE_PERIOD);

    // 고유한 slug 생성
    const slug = await this.generateUniqueSlug();
    return await TransactionManager.run(async (con) => {
      const input: CreateCalendarInput = {
        slug,
        title: title.trim(),
        description: description?.trim(),
        start_date: startDate,
        end_date: endDate,
        owner_id: ownerId,
        expired_at: expired_at,
      };

      const calendar = await this.calendarRepository.create(input, con);

      const dateList: string[] = [];
      const currentDate = new Date(startDate);
      const end = new Date(endDate);

      while (currentDate <= end) {
        dateList.push(currentDate.toISOString().split('T')[0]); // YYYY-MM-DD
        currentDate.setDate(currentDate.getDate() + 1);
      }

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

  /**
   * TOdo: 사용자의 캘린더 목록 조회 => 참가자uuid포함해서 반환하는 메서드로 변경할것, 현재 메서드가 사용중인 부분 확인 후 삭제
   */
  async getUserCalendars(ownerId: number): Promise<Calendar[]> {
    return await this.calendarRepository.findByOwnerId(ownerId);
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

    if (input.end_date !== undefined) {
      input.expired_at = this.addDate(input.end_date, CALENDAR_GRACE_PERIOD);
    }

    // 날짜 범위 검증
    if (input.start_date || input.end_date) {
      const startDate = input.start_date || calendar.start_date;
      const endDate = input.end_date || calendar.end_date;
      this.validateDateRange(startDate.toString(), endDate.toString());
    }

    const updated = await this.calendarRepository.update(calendar.id, input);

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
