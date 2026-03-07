import cron from 'node-cron';

import { logger } from '../middlewares/logger';
import { ICalendarRepository } from '../repositories/calendar.repository';
import { getIO } from '../sockets';

export class CronService {
  constructor(private calendarRepository: ICalendarRepository) {}

  public start() {
    cron.schedule('0 4 * * *', async () => {
      logger.info('[Cron] 새벽 4시 정기 점검 시작');

      await this.deleteExpiredCalendars();

      await this.closeEndedCalendars();

      logger.info('[Cron] 정기 점검 종료');
    });
  }

  private async deleteExpiredCalendars() {
    try {
      const expiredCalendars = await this.calendarRepository.findExpired();

      if (expiredCalendars.length === 0) return;

      logger.info(`[Cron] 보관 기간이 지난 ${expiredCalendars.length}개의 캘린더를 삭제`);

      const expiredCalendarIds = expiredCalendars.map((calendar) => calendar.id);

      const deletedCalendars = await this.calendarRepository.deleteByIds(expiredCalendarIds);

      if (expiredCalendars.length !== deletedCalendars) {
        logger.warn(
          `[Cron] 캘린더 삭제 개수 불일치. (대상: ${expiredCalendars.length}개, 실제 삭제: ${deletedCalendars}개)`
        );
      }

      const io = getIO();

      for (const calendar of expiredCalendars) {
        try {
          io.to(calendar.slug).emit('calendarDeleted', {
            message: '보관 기간(30일)이 만료되어 캘린더가 영구 삭제되었습니다.',
          });
          io.in(calendar.slug).disconnectSockets(true);

          logger.info(`[Cron] 삭제 완료: ${calendar.slug}`);
        } catch (error) {
          logger.error(`[Cron] 삭제 실패: ${calendar.slug}`, error);
        }
      }
    } catch (err) {
      logger.error('[Cron] 삭제 작업 중 오류 발생', err);
    }
  }

  private async closeEndedCalendars() {
    try {
      const targetCalendars = await this.calendarRepository.findEndedAndOpen();

      if (targetCalendars.length === 0) return;

      logger.info(`[Cron] 투표 기간이 끝난 ${targetCalendars.length}개의 캘린더를 마감`);

      const targetCalendarIds = targetCalendars.map((calendar) => calendar.id);

      const closedCalendarsCount = await this.calendarRepository.closeByIds(targetCalendarIds);

      if (targetCalendars.length !== closedCalendarsCount) {
        logger.warn(
          `[Cron] 캘린더 마감 개수 불일치. (대상: ${targetCalendars.length}개, 실제 마감: ${closedCalendarsCount}개)`
        );
      }

      const io = getIO();

      for (const calendar of targetCalendars) {
        try {
          io.to(calendar.slug).emit('calendarClosed', {
            message: '투표 기간이 종료되어 자동 마감되었습니다.',
            isClosed: true,
          });

          logger.info(`[Cron] 마감 완료: ${calendar.slug}`);
        } catch (error) {
          logger.error(`[Cron] 마감 실패: ${calendar.slug}`, error);
        }
      }
    } catch (err) {
      logger.error('❌ [Cron] 마감 작업 중 오류 발생', err);
    }
  }
}
