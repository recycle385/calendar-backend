import { TransactionManager } from '../infrastructure/transaction.manager';
import { DateVoteStatus, VoteRecordForParticipant } from '../models/Vote';
import { VoteType } from '../models/Vote';
import { IDateOptionRepository } from '../repositories/dateOption.repository';
import { IVoteRepository } from '../repositories/vote.repository';
import { Errors } from '../utils/errors';

export interface IVoteService {
  submitVotes(
    participantId: number,
    calendarId: number,
    selectedDates: string[],
    voteType?: VoteType
  ): Promise<number>;
  getVotesByParticipant(participantId: number): Promise<VoteRecordForParticipant[]>;
  getVoteStatusByCalendar(calendarId: number): Promise<DateVoteStatus[]>;
  deleteVotes(participantId: number): Promise<void>;
}

export class VoteService implements IVoteService {
  constructor(
    private voteRepository: IVoteRepository,
    private dateOptionRepository: IDateOptionRepository
  ) {}

  /**
   * 참가자의 투표 제출 (복수 날짜)
   */
  async submitVotes(
    participantId: number,
    calendarId: number,
    selectedDates: string[],
    voteType: VoteType = 'available'
  ): Promise<number> {
    return TransactionManager.run(async (connection) => {
      if (!selectedDates || selectedDates.length === 0) {
        throw Errors.BadRequest('최소 하나 이상의 날짜를 선택해야 합니다');
      }

      // 날짜 옵션 ID 조회
      const dateOption = await this.dateOptionRepository.findDateOptionsByCalendarAndDate(
        calendarId,
        selectedDates,
        connection
      );

      if (dateOption.length !== selectedDates.length) {
        throw Errors.BadRequest('유효하지 않은 날짜가 포함되어 있습니다');
      }

      const dateOptionIds: number[] = [];

      for (const option of dateOption) {
        if (!option.is_enabled) {
          throw Errors.BadRequest(`비활성화된 날짜입니다: ${option.date_value}`);
        }
        dateOptionIds.push(option.id);
      }

      const count = await this.voteRepository.upsertVotes(
        participantId,
        dateOptionIds,
        voteType, // 기본값: 가능,
        connection
      );

      return count;
    });
  }

  /**
   * 참가자의 투표 내역 조회
   */
  async getVotesByParticipant(participantId: number): Promise<VoteRecordForParticipant[]> {
    const votes = await this.voteRepository.findAllByParticipant(participantId);

    if (votes.length === 0) {
      return [];
    }
    const idArray = votes.map((s) => s.date_option_id);

    const dateOptions = await this.dateOptionRepository.findOptionsByIds(idArray);

    if (idArray.length !== dateOptions.length) {
      throw Errors.Internal('내부오류');
    }

    const dateOptionMap = new Map(dateOptions.map((option) => [option.id, option]));

    return votes
      .filter((vote) => dateOptionMap.has(vote.date_option_id))
      .map((vote) => {
        const dateOption = dateOptionMap.get(vote.date_option_id)!;
        return {
          vote_id: vote.id,
          date_value: dateOption.date_value,
          vote_type: vote.vote_type,
          created_at: vote.created_at,
        };
      });
  }

  /**
   * 캘린더의 날짜별 투표 현황 조회
   */
  async getVoteStatusByCalendar(calendarId: number): Promise<DateVoteStatus[]> {
    return await this.voteRepository.getDateVoteStatus(calendarId);
  }

  /**
   * 참가자의 모든 투표 삭제
   */
  async deleteVotes(participantId: number): Promise<void> {
    await this.voteRepository.deleteAllByParticipant(participantId);
  }
}
