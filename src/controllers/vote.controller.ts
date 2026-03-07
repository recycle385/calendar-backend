import { RequestHandler } from 'express';

import {} from '../middlewares/auth';
import { ICalendarService } from '../services/calendar.service';
import { IParticipantService } from '../services/participant.service';
import { IVoteService } from '../services/vote.service';
import { getIO } from '../sockets';
import { Errors } from '../utils/errors';

export class VoteController {
  constructor(
    private voteService: IVoteService,
    private calendarService: ICalendarService,
    private participantService: IParticipantService
  ) {}

  public submitVotes: RequestHandler = async (req, res) => {
    const { slug } = req.params;
    const { selectedDates, voteType } = req.body;

    const userParticipantUuid = req.participantUuid;
    const userRole = req.userRole;

    if (!userParticipantUuid || !userRole) {
      throw Errors.Internal('인증 실패'); // todo: 주석 수정
    }

    // 캘린더 조회
    const calendar = await this.calendarService.getCalendarBySlug(slug);

    // 마감된 캘린더는 투표 불가
    if (calendar.is_closed) {
      throw Errors.BadRequest('마감된 캘린더에는 투표할 수 없습니다');
    }

    const endDate = new Date(calendar.end_date);

    const todayZero = new Date();
    todayZero.setHours(0, 0, 0, 0);

    if (todayZero > endDate) {
      throw Errors.BadRequest('투표 기간이 종료되었습니다');
    }

    // 참가자 인증
    const participant = await this.participantService.getParticipantByUuid(userParticipantUuid);

    // 캘린더 일치 확인
    if (participant.calendar_id !== calendar.id) {
      throw Errors.Forbidden('이 캘린더의 참가자가 아닙니다');
    }

    // 투표 저장
    const count = await this.voteService.submitVotes(
      participant.id,
      calendar.id,
      selectedDates,
      voteType
    );

    // 실시간 투표 현황 조회 및 WebSocket 브로드캐스트
    const voteStatus = await this.voteService.getVoteStatusByCalendar(calendar.id);
    const io = getIO();
    io.to(slug).emit('voteUpdated', {
      calendarSlug: slug,
      participantUuId: participant.participant_uuid,
      participantNickname: participant.nickname,
      voteStatus,
      timestamp: new Date().toISOString(),
    });

    return res.status(200).json({
      message: '투표가 제출되었습니다',
      votedCount: count,
      selectedDates,
    });
  };

  public getVoteStatus: RequestHandler = async (req, res) => {
    const { slug } = req.params;

    const calendar = await this.calendarService.getCalendarBySlug(slug);

    const voteStatus = await this.voteService.getVoteStatusByCalendar(calendar.id);

    return res.status(200).json({
      calendar: {
        slug: calendar.slug,
        title: calendar.title,
        start_date: calendar.start_date,
        end_date: calendar.end_date,
        is_closed: calendar.is_closed,
      },
      voteStatus,
    });
  };

  public getParticipantVotes: RequestHandler = async (req, res) => {
    const { slug, participantUuid } = req.params;

    const calendar = await this.calendarService.getCalendarBySlug(slug);

    const participant = await this.participantService.getParticipantByUuid(participantUuid);

    if (participant.calendar_id !== calendar.id) {
      throw Errors.NotFound('참가자를 찾을 수 없습니다');
    }

    const votes = await this.voteService.getVotesByParticipant(participant.id);

    return res.status(200).json({
      participant: {
        uuid: participant.participant_uuid,
        nickname: participant.nickname,
        color_code: participant.color_code,
      },
      votes,
      voteCount: votes.length,
    });
  };
}
