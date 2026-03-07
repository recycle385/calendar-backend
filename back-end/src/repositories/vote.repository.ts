import { ResultSetHeader, RowDataPacket } from 'mysql2';
import { PoolConnection } from 'mysql2/promise';

import dbpool from '../config/database';
import { DateOption } from '../models/DateOption';
import { CreateVoteInput, DateVoteStatus, Vote, VoteType } from '../models/Vote';
import { Errors } from '../utils/errors';

export interface IVoteRepository {
  // 투표 생성/수정
  upsertVote(input: CreateVoteInput, connection?: PoolConnection): Promise<Vote>;
  upsertVotes(
    participantId: number,
    dateOptionIds: number[],
    voteType: VoteType,
    connection?: PoolConnection
  ): Promise<number>;

  // 투표 조회
  findByParticipantAndDateOption(
    participantId: number,
    dateOptionId: number,
    connection?: PoolConnection
  ): Promise<Vote | null>;
  findAllByParticipant(participantId: number, connection?: PoolConnection): Promise<Vote[]>;
  findAllByCalendar(calendarId: number, connection?: PoolConnection): Promise<Vote[]>;

  // 투표 삭제
  delete(participantId: number, dateOptionId: number): Promise<boolean>;
  deleteAllByParticipant(participantId: number): Promise<number>;

  // 날짜별 투표 현황
  getDateVoteStatus(calendarId: number): Promise<DateVoteStatus[]>;
}

export class VoteRepository implements IVoteRepository {
  constructor(private pool = dbpool) {}
  /**
   * 투표 생성 또는 수정 (UPSERT)
   */
  async upsertVote(input: CreateVoteInput, connection?: PoolConnection): Promise<Vote> {
    const poolToUse = connection || this.pool;
    const { participant_id, date_option_id, vote_type } = input;

    await poolToUse.execute(
      `INSERT INTO votes (participant_id, date_option_id, vote_type)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE
         vote_type = VALUES(vote_type),
         updated_at = CURRENT_TIMESTAMP`,
      [participant_id, date_option_id, vote_type]
    );

    const vote = await this.findByParticipantAndDateOption(
      participant_id,
      date_option_id,
      connection
    );
    if (!vote) {
      throw Errors.Internal('투표 생성 후 조회 실패');
    }

    return vote;
  }

  /**
   * 복수 날짜에 대한 투표 일괄 처리
   */
  async upsertVotes(
    participantId: number,
    dateOptionIds: number[],
    voteType: VoteType,
    connection?: PoolConnection
  ): Promise<number> {
    const poolToUse = connection || this.pool;
    if (dateOptionIds.length === 0) {
      return 0;
    }

    // 참가자의 기존 투표 모두 삭제
    await this.deleteAllByParticipant(participantId, connection);

    // 새로운 투표 일괄 삽입
    const values = dateOptionIds.map((dateOptionId) => [participantId, dateOptionId, voteType]);

    const [result] = await poolToUse.query<ResultSetHeader>(
      `INSERT INTO votes (participant_id, date_option_id, vote_type)
       VALUES ?`,
      [values]
    );

    return result.affectedRows;
  }

  /**
   * 참가자 + 날짜 옵션으로 투표 조회
   */
  async findByParticipantAndDateOption(
    participantId: number,
    dateOptionId: number,
    connection?: PoolConnection
  ): Promise<Vote | null> {
    const poolToUse = connection || this.pool;

    const [rows] = await poolToUse.execute<RowDataPacket[]>(
      'SELECT * FROM votes WHERE participant_id = ? AND date_option_id = ?',
      [participantId, dateOptionId]
    );

    if (rows.length === 0) {
      return null;
    }

    return this.mapToVote(rows[0]);
  }

  /**
   * 참가자의 모든 투표 조회
   */
  async findAllByParticipant(participantId: number, connection?: PoolConnection): Promise<Vote[]> {
    const poolToUse = connection || this.pool;

    const [rows] = await poolToUse.execute<RowDataPacket[]>(
      'SELECT * FROM votes WHERE participant_id = ? ORDER BY created_at ASC',
      [participantId]
    );

    return rows.map((row) => this.mapToVote(row));
  }

  /**
   * 캘린더의 모든 투표 조회
   */
  async findAllByCalendar(calendarId: number, connection?: PoolConnection): Promise<Vote[]> {
    const poolToUse = connection || this.pool;

    const [rows] = await poolToUse.execute<RowDataPacket[]>(
      `SELECT v.*
       FROM votes v
       JOIN date_options d ON v.date_option_id = d.id
       WHERE d.calendar_id = ?
       ORDER BY v.created_at ASC`,
      [calendarId]
    );

    return rows.map((row) => this.mapToVote(row));
  }

  /**
   * 투표 삭제
   */
  async delete(
    participantId: number,
    dateOptionId: number,
    connection?: PoolConnection
  ): Promise<boolean> {
    const poolToUse = connection || this.pool;

    const [result] = await poolToUse.execute<ResultSetHeader>(
      'DELETE FROM votes WHERE participant_id = ? AND date_option_id = ?',
      [participantId, dateOptionId]
    );

    return result.affectedRows > 0;
  }

  /**
   * 참가자의 모든 투표 삭제
   */
  async deleteAllByParticipant(
    participantId: number,
    connection?: PoolConnection
  ): Promise<number> {
    const poolToUse = connection || this.pool;

    const [result] = await poolToUse.execute<ResultSetHeader>(
      'DELETE FROM votes WHERE participant_id = ?',
      [participantId]
    );

    return result.affectedRows;
  }

  /**
   * 날짜별 투표 현황 조회 (그래프용)
   */
  async getDateVoteStatus(
    calendarId: number,
    connection?: PoolConnection
  ): Promise<DateVoteStatus[]> {
    const poolToUse = connection || this.pool;

    const [rows] = await poolToUse.execute<RowDataPacket[]>(
      `SELECT
        d.id as date_option_id,
        d.date_value,
        d.is_enabled,
        p.id as participant_id,
        p.nickname as participant_nickname,
        p.color_code as participant_color,
        v.vote_type
       FROM date_options d
       LEFT JOIN votes v ON d.id = v.date_option_id
       LEFT JOIN participants p ON v.participant_id = p.id
       WHERE d.calendar_id = ?
       ORDER BY d.date_value ASC, p.joined_at ASC`,
      [calendarId]
    );

    // 날짜별로 그룹화
    const dateMap = new Map<number, DateVoteStatus>();

    for (const row of rows) {
      const dateOptionId = row.date_option_id;

      if (!dateMap.has(dateOptionId)) {
        dateMap.set(dateOptionId, {
          date_option_id: dateOptionId,
          date_value: new Date(row.date_value),
          is_enabled: Boolean(row.is_enabled),
          votes: [],
        });
      }

      // 투표가 있는 경우에만 추가
      if (row.participant_id) {
        dateMap.get(dateOptionId)!.votes.push({
          participant_id: row.participant_id,
          participant_nickname: row.participant_nickname,
          participant_color: row.participant_color,
          vote_type: row.vote_type,
        });
      }
    }

    return Array.from(dateMap.values());
  }

  private mapToVote(row: RowDataPacket): Vote {
    return {
      id: row.id,
      participant_id: row.participant_id,
      date_option_id: row.date_option_id,
      vote_type: row.vote_type as VoteType,
      created_at: new Date(row.created_at),
      updated_at: new Date(row.updated_at),
    };
  }
}
