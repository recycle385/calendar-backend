import { RequestHandler } from 'express';

import { logger } from '../middlewares/logger';
import { ParticipantServiceInput } from '../models';
import { ICalendarService } from '../services/calendar.service';
import { IParticipantService } from '../services/participant.service';
import { IUserService } from '../services/user.service';
import { getIO } from '../sockets';
import { ITokenService } from '../types/token.types';
import { Errors } from '../utils/errors';

export class ParticipantController {
  constructor(
    private participantService: IParticipantService,
    private calendarService: ICalendarService,
    private userService: IUserService,
    private tokenService: ITokenService
  ) {}

  public registerParticipant: RequestHandler = async (req, res) => {
    const { slug } = req.params;
    const { nickname, password } = req.body;

    const userUuid = req.userUuid;

    const calendar = await this.calendarService.getCalendarBySlug(slug);

    if (calendar.is_closed) {
      throw Errors.BadRequest('마감된 캘린더에는 참가할 수 없습니다');
    }

    let participantServiceInput: ParticipantServiceInput;

    if (userUuid) {
      const userId = await this.userService.getIdUsingUuid(userUuid);

      participantServiceInput = {
        role: 'guest',
        calendarId: calendar.id,
        nickname: nickname,
        userId: userId,
      };
    } else {
      if (!password) {
        throw Errors.BadRequest('게스트는 비번이 필수입니다');
      }

      participantServiceInput = {
        role: 'guest',
        calendarId: calendar.id,
        nickname: nickname,
        password: password,
      };
    }

    const result = await this.participantService.registerParticipant(participantServiceInput);

    const participantToken = this.tokenService.generateParticipantToken({
      sub: result.participant.participant_uuid,
      nickname: result.participant.nickname,
      calendarId: slug,
      role: result.participant.role,

      userUuid: userUuid,
    });

    return res.status(201).json({
      message: '참가자 등록이 완료되었습니다',
      participant: {
        uuid: result.participant.participant_uuid,
        nickname: result.participant.nickname,
        color_code: result.participant.color_code,
        joined_at: result.participant.joined_at,
        role: result.participant.role,
      },
      participantToken: participantToken,
    });
  };

  public loginParticipant: RequestHandler = async (req, res) => {
    const { slug } = req.params;
    const { nickname, password } = req.body;
    const userUuid = req.userUuid;

    const calendar = await this.calendarService.getCalendarBySlug(slug);

    let result;
    if (userUuid) {
      const userId = await this.userService.getIdUsingUuid(userUuid);

      result = await this.participantService.loginGuestUserAsParticipant(calendar.id, userId);
    } else {
      if (!nickname || !password) {
        throw Errors.BadRequest('닉네임과 비밀번호는 필수입니다');
      }
      result = await this.participantService.loginParticipant(calendar.id, nickname, password);
    }

    const participantToken = await this.tokenService.generateParticipantToken({
      sub: result.participantUuid,
      nickname: result.participant.nickname,
      role: result.participant.role,
      calendarId: slug,

      userUuid: userUuid,
    });

    return res.status(200).json({
      message: '로그인 성공',
      participant: {
        uuid: result.participant.participant_uuid,
        nickname: result.participant.nickname,
        color_code: result.participant.color_code,
        joined_at: result.participant.joined_at,
      },
      participantToken: participantToken,
    });
  };

  public getParticipants: RequestHandler = async (req, res) => {
    const { slug } = req.params;

    const calendar = await this.calendarService.getCalendarBySlug(slug);

    const participants = await this.participantService.getParticipantsWithVotes(calendar.id);

    const sanitizedParticipants = participants.map((p) => ({
      uuid: p.participant_uuid,
      nickname: p.nickname,
      color_code: p.color_code,
      joined_at: p.joined_at,
      vote_count: p.vote_count,
      total_dates: p.total_dates,
      vote_rate: p.vote_rate,
    }));

    return res.status(200).json({
      participants: sanitizedParticipants,
      count: sanitizedParticipants.length,
    });
  };

  public deleteParticipantSelf: RequestHandler = async (req, res) => {
    const { slug } = req.params;

    const targetUuid = req.participantUuid;
    const userRole = req.userRole;

    if (!targetUuid || !userRole) {
      throw Errors.Internal('인증정보가 없습니다.');
    }

    if (userRole === 'host') {
      throw Errors.BadRequest('방장은 방장을 삭제할 수 없습니다 캘린더 삭제 이용.');
    }
    const calendar = await this.calendarService.getCalendarBySlug(slug);

    const participantId = await this.participantService.getParticipantIdByUuid(targetUuid);

    await this.participantService.deleteParticipant(participantId, calendar.id);

    const io = getIO();

    const sockets = await io.in(slug).fetchSockets();

    for (const socket of sockets) {
      if (socket.data.sub === targetUuid) {
        socket.disconnect(true);
        logger.warn(`삭제된 유저(${targetUuid}) 소켓 연결 해제`);
      }
    }

    return res.status(200).json({
      message: '참가자가 삭제되었습니다',
    });
  };

  public deleteParticipantAsHost: RequestHandler = async (req, res) => {
    const { slug, participantUuid } = req.params;
    const targetUuid = participantUuid;

    const userParticipantUuid = req.participantUuid;
    const userParticipantRole = req.userRole;

    if (!userParticipantUuid || !userParticipantRole) {
      throw Errors.Internal('인증 실패'); //todo 주석 수정
    }

    if (userParticipantRole !== 'host') {
      throw Errors.Forbidden('강퇴 권한이 없음');
    }

    if (!req.userUuid) {
      throw Errors.Unauthorized('잘못된 토큰');
    }

    if (userParticipantUuid === targetUuid) {
      throw Errors.BadRequest('방장은 방장을 삭제할 수 없습니다 캘린더 삭제 이용.');
    }

    const calendar = await this.calendarService.getCalendarBySlug(slug);

    const targetId = await this.participantService.getParticipantIdByUuid(targetUuid);

    await this.participantService.deleteParticipant(targetId, calendar.id);

    const io = getIO();

    const sockets = await io.in(slug).fetchSockets();

    for (const socket of sockets) {
      if (socket.data.sub === targetUuid) {
        socket.disconnect(true);
        logger.warn(`삭제된 유저(${targetUuid}) 소켓 연결 해제`);
      }
    }

    return res.status(200).json({
      message: '참가자가 삭제되었습니다',
    });
  };
}
