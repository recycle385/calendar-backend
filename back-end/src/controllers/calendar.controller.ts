import { RequestHandler } from 'express';

import { Calendar, SafeCalendar } from '../models';
import { ICalendarService } from '../services/calendar.service';
import { IParticipantService } from '../services/participant.service';
import { IUserService } from '../services/user.service';
import { getIO } from '../sockets';
import { ITokenService } from '../types/token.types';
import { Errors } from '../utils/errors';

export class CalendarController {
  constructor(
    private calendarService: ICalendarService,
    private userService: IUserService,
    private participantService: IParticipantService,
    private tokenService: ITokenService
  ) {}

  public createCalendar: RequestHandler = async (req, res) => {
    const userUuid = req.userUuid;

    if (!userUuid) {
      throw Errors.Unauthorized('로그인이 필요합니다');
    }

    const { title, start_date, end_date, description, hostNickname } = req.body;

    const userId = await this.userService.getIdUsingUuid(userUuid);

    const result = await this.calendarService.createCalendar(
      userId, //ownerId = 저장할때는 user id, 내보낼때는 participantUuid
      title,
      start_date,
      end_date,
      hostNickname,
      description
    );

    const participantToken = await this.tokenService.generateParticipantToken({
      sub: result.participantUuid,
      nickname: hostNickname,
      calendarId: result.calendar.slug,
      role: 'host',

      userUuid: userUuid,
    });

    return res.status(201).json({
      message: '캘린더가 생성되었습니다',
      calendar: this.changeToSafeCalendar(result.calendar, result.participantUuid), //ownerId = 저장할때는 user id, 내보낼때는 participantUuid
      shareUrl: result.shareUrl,
      participantToken: participantToken,
    });
  };

  public getCalendarBySlug: RequestHandler = async (req, res) => {
    const { slug } = req.params;

    const calendar = await this.calendarService.getCalendarBySlug(slug);

    const hostParticipantUuid =
      await this.participantService.getParticipantUuidByUserIdAndCalendarId(
        calendar.owner_id,
        calendar.id
      );

    return res.status(200).json({
      message: '데이터를 불러왔습니다',
      calendar: this.changeToSafeCalendar(calendar, hostParticipantUuid),
    });
  };

  public getMyCalendars: RequestHandler = async (req, res) => {
    const userUuid = req.userUuid;

    if (!userUuid) {
      throw Errors.Unauthorized('로그인이 필요합니다');
    }

    const userId = await this.userService.getIdUsingUuid(userUuid);

    const calendars = await this.calendarService.getUserCalendarsWithPUuids(userId);

    const safeCalendars = calendars.map((calendar) => {
      return this.changeToSafeCalendar(calendar, calendar.hostParticipantUuid);
    });

    return res.status(200).json({
      calendars: safeCalendars,
      count: safeCalendars.length,
    });
  };

  public updateCalendar: RequestHandler = async (req, res) => {
    const { slug } = req.params;

    const userParticipantUuid = req.participantUuid;
    const userRole = req.userRole;
    const userUuid = req.userUuid;

    if (!userParticipantUuid || !userRole) {
      throw Errors.Internal('인증실패');
    }

    if (userRole !== 'host' || !userUuid) {
      throw Errors.Forbidden('캘린더 수정은 방장만 가능합니다');
    }

    const { title, description, start_date, end_date } = req.body;

    if (!title && !description && !start_date && !end_date) {
      res.status(200).json({
        message: '변경사항이 없습니다',
      });
      return;
    }

    const userId = await this.userService.getIdUsingUuid(userUuid);

    const calendar = await this.calendarService.updateCalendar(slug, userId, {
      title,
      description,
      start_date,
      end_date,
    });

    const io = getIO();

    io.to(slug).emit('calendarUpdated', {
      message: '캘린더 정보가 수정되었습니다.',
      calendar: this.changeToSafeCalendar(calendar, userParticipantUuid),
    });

    return res.status(200).json({
      message: '캘린더가 수정되었습니다',
      calendar: this.changeToSafeCalendar(calendar, userParticipantUuid),
    });
  };

  public deleteCalendar: RequestHandler = async (req, res) => {
    const { slug } = req.params;

    const userParticipantUuid = req.participantUuid;
    const userRole = req.userRole;
    const userUuid = req.userUuid;

    if (!userParticipantUuid || !userRole) {
      throw Errors.Internal('인증실패');
    }

    if (userRole !== 'host' || !userUuid) {
      throw Errors.Forbidden('캘린더 수정은 방장만 가능합니다');
    }

    const userId = await this.userService.getIdUsingUuid(userUuid);

    await this.calendarService.deleteCalendar(slug, userId);

    const io = getIO();

    io.to(slug).emit('calendarDeleted', {
      message: '방장에 의해 캘린더가 삭제되었습니다.',
    });

    io.in(slug).disconnectSockets(true);

    return res.status(200).json({
      message: '캘린더가 삭제되었습니다',
    });
  };

  public closeCalendar: RequestHandler = async (req, res) => {
    const { slug } = req.params;

    const userParticipantUuid = req.participantUuid;
    const userRole = req.userRole;
    const userUuid = req.userUuid;

    if (!userParticipantUuid || !userRole) {
      throw Errors.Internal('인증실패');
    }

    if (userRole !== 'host' || !userUuid) {
      throw Errors.Forbidden('캘린더 마감은 방장만 가능합니다');
    }

    const userId = await this.userService.getIdUsingUuid(userUuid);

    const calendar = await this.calendarService.closeCalendar(slug, userId);

    const io = getIO();
    io.to(slug).emit('calendarClosed', {
      message: '투표가 마감되었습니다.',
      isClosed: true,
    });

    return res.status(200).json({
      message: '캘린더가 마감되었습니다',
      calendar: this.changeToSafeCalendar(calendar, userParticipantUuid),
    });
  };

  private changeToSafeCalendar(calendar: Calendar, hostParticipantUuid: string): SafeCalendar {
    return {
      slug: calendar.slug,
      title: calendar.title,
      description: calendar.description,
      start_date: calendar.start_date,
      end_date: calendar.end_date,
      is_closed: calendar.is_closed,
      hostParticipantUuid: hostParticipantUuid, // useruuid가 아니라 participantuuid 넣어야함 (safe 응답용)
      created_at: calendar.created_at,
      expired_at: calendar.expired_at,
    };
  }
}
