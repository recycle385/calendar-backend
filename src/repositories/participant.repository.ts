import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { PoolConnection } from 'mysql2/promise';

import dbpool from '../config/database';
import {
  CreateParticipantInput,
  Participant,
  ParticipantCheckInput,
  ParticipantWithVotes,
} from '../models/Participant';
import { Errors } from '../utils/errors';

export interface IParticipantRepository {
  create(input: CreateParticipantInput, connection?: PoolConnection): Promise<Participant>;
  findById(id: number, connection?: PoolConnection): Promise<Participant | null>;
  findByUuid(uuid: string, connection?: PoolConnection): Promise<Participant | null>;
  existsByUuid(uuid: string, connection?: PoolConnection): Promise<boolean>;
  existsByCalendarAndUser(
    calendarId: number,
    userId: number,
    connection?: PoolConnection
  ): Promise<boolean>;
  getIdUsingUuid(uuid: string, connection?: PoolConnection): Promise<number>;
  getUuidUsingId(id: number, connection?: PoolConnection): Promise<string>;
  getParticipantUuidByUserIdAndCalendarId(
    id: number,
    calendar_id: number,
    connection?: PoolConnection
  ): Promise<string>;
  findUserGuestById(
    calendarId: number,
    userId: number,
    connection?: PoolConnection
  ): Promise<Participant | null>;
  findByCalendarAndNickname(
    calendarId: number,
    nickname: string,
    connection?: PoolConnection
  ): Promise<Participant | null>;
  findAllByCalendarId(calendarId: number, connection?: PoolConnection): Promise<Participant[]>;
  findAllByCalendarIdWithVotes(
    calendarId: number,
    connection?: PoolConnection
  ): Promise<ParticipantWithVotes[]>;
  nicknameExists(check: ParticipantCheckInput, connection?: PoolConnection): Promise<boolean>;
  delete(id: number, connection?: PoolConnection): Promise<boolean>;
}

export class ParticipantRepository implements IParticipantRepository {
  constructor(private pool = dbpool) {}

  /**
   * 새로운 참가자 생성
   */
  async create(input: CreateParticipantInput, connection?: PoolConnection): Promise<Participant> {
    const poolToUse = connection || this.pool;

    const { participant_uuid, calendar_id, role, nickname, color_code } = input;

    let user_id: number | null;
    let password_hash: string | null;

    if (role === 'host') {
      user_id = input.user_id;
      password_hash = null;
    } else {
      if ('password_hash' in input && input.password_hash !== undefined) {
        user_id = null;
        password_hash = input.password_hash;
      } else if ('user_id' in input && input.user_id !== undefined) {
        user_id = input.user_id;
        password_hash = null;
      } else {
        throw Errors.BadRequest('게스트는 user_id 또는 password_hash 중 하나가 필요합니다');
      }
    }

    const [result] = await poolToUse.execute<ResultSetHeader>(
      `INSERT INTO participants (participant_uuid, calendar_id, user_id, role, nickname, password_hash, color_code)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        participant_uuid,
        calendar_id,
        user_id,
        role,
        nickname,
        password_hash,
        color_code || '#FF0000',
      ]
    );

    const participant = await this.findById(result.insertId, connection);
    if (!participant) {
      throw Errors.Internal('참가자 생성 후 조회 실패');
    }

    return participant;
  }

  /**
   * ID로 참가자 조회
   */
  async findById(id: number, connection?: PoolConnection): Promise<Participant | null> {
    const poolToUse = connection || this.pool;

    const [rows] = await poolToUse.execute<RowDataPacket[]>(
      'SELECT * FROM participants WHERE id = ?',
      [id]
    );

    if (rows.length === 0) {
      return null;
    }

    return this.mapToParticipant(rows[0]);
  }

  /**
   * UUID로 참가자 조회
   */
  async findByUuid(uuid: string, connection?: PoolConnection): Promise<Participant | null> {
    const poolToUse = connection || this.pool;

    const [rows] = await poolToUse.execute<RowDataPacket[]>(
      'SELECT * FROM participants WHERE participant_uuid = ?',
      [uuid]
    );

    if (rows.length === 0) {
      return null;
    }

    return this.mapToParticipant(rows[0]);
  }

  async existsByUuid(uuid: string, connection?: PoolConnection): Promise<boolean> {
    const poolToUse = connection || this.pool;

    const [rows] = await poolToUse.execute<RowDataPacket[]>(
      'SELECT 1 FROM participants WHERE participant_uuid = ? LIMIT 1',
      [uuid]
    );

    return rows.length > 0;
  }

  async existsByCalendarAndUser(
    calendarId: number,
    userId: number,
    connection?: PoolConnection
  ): Promise<boolean> {
    const poolToUse = connection || this.pool;
    const [rows] = await poolToUse.execute<RowDataPacket[]>(
      'SELECT 1 FROM participants WHERE calendar_id = ? AND user_id = ? LIMIT 1',
      [calendarId, userId]
    );

    return rows.length > 0;
  }

  async findUserGuestById(
    calendarId: number,
    userId: number,
    connection?: PoolConnection
  ): Promise<Participant | null> {
    const poolToUse = connection || this.pool;

    const [rows] = await poolToUse.execute<RowDataPacket[]>(
      'select * from participants where calendar_id = ? and user_id = ? limit 1',
      [calendarId, userId]
    );

    if (rows.length === 0) {
      return null;
    }

    return this.mapToParticipant(rows[0]);
  }

  /**
   * 캘린더 ID와 닉네임으로 참가자 조회
   */
  async findByCalendarAndNickname(
    calendarId: number,
    nickname: string,
    connection?: PoolConnection
  ): Promise<Participant | null> {
    const poolToUse = connection || this.pool;

    const [rows] = await poolToUse.execute<RowDataPacket[]>(
      'SELECT * FROM participants WHERE calendar_id = ? AND nickname = ?',
      [calendarId, nickname]
    );

    if (rows.length === 0) {
      return null;
    }

    return this.mapToParticipant(rows[0]);
  }

  async getIdUsingUuid(uuid: string, connection?: PoolConnection): Promise<number> {
    const poolToUse = connection || this.pool;

    const [rows] = await poolToUse.execute<RowDataPacket[]>(
      'select id from participants where participant_uuid = ?',
      [uuid]
    );

    if (rows.length === 0) {
      throw Errors.NotFound('유저 조회 실패');
    }

    return rows[0].id;
  }

  async getUuidUsingId(id: number, connection?: PoolConnection): Promise<string> {
    const poolToUse = connection || this.pool;

    const [rows] = await poolToUse.execute<RowDataPacket[]>(
      'select participant_uuid from participants where id = ?',
      [id]
    );

    if (rows.length === 0) {
      throw Errors.NotFound('유저 조회 실패');
    }

    return rows[0].participant_uuid;
  }

  async getParticipantUuidByUserIdAndCalendarId(
    id: number,
    calendar_id: number,
    connection?: PoolConnection
  ): Promise<string> {
    const poolToUse = connection || this.pool;

    const [rows] = await poolToUse.execute<RowDataPacket[]>(
      'select participant_uuid from participants where user_id = ? and calendar_id = ?',
      [id, calendar_id]
    );

    if (rows.length === 0) {
      throw Errors.NotFound('유저 조회 실패');
    }

    return rows[0].participant_uuid;
  }

  /**
   * 캘린더의 모든 참가자 조회
   */
  async findAllByCalendarId(
    calendarId: number,
    connection?: PoolConnection
  ): Promise<Participant[]> {
    const poolToUse = connection || this.pool;

    const [rows] = await poolToUse.execute<RowDataPacket[]>(
      'SELECT * FROM participants WHERE calendar_id = ? ORDER BY joined_at ASC',
      [calendarId]
    );

    return rows.map((row) => this.mapToParticipant(row));
  }

  /**
   * 캘린더의 모든 참가자 조회 (투표 현황 포함)
   */
  async findAllByCalendarIdWithVotes(
    calendarId: number,
    connection?: PoolConnection
  ): Promise<ParticipantWithVotes[]> {
    const poolToUse = connection || this.pool;

    const [rows] = await poolToUse.execute<RowDataPacket[]>(
      `SELECT p.*, COUNT(DISTINCT v.date_option_id) as vote_count
      FROM participants p
      LEFT JOIN votes v ON p.id = v.participant_id
      WHERE p.calendar_id = ?
      GROUP BY p.id
      ORDER BY p.joined_at ASC`,
      [calendarId]
    );

    if (rows.length === 0) {
      return [];
    }

    const [dateCountRow] = await poolToUse.execute<RowDataPacket[]>(
      'SELECT COUNT(*) as count FROM date_options WHERE calendar_id = ?',
      [calendarId]
    );
    const totalDates = Number(dateCountRow[0].count);

    return rows.map((row) => ({
      ...this.mapToParticipant(row),
      vote_count: Number(row.vote_count),
      total_dates: totalDates,
      vote_rate: totalDates > 0 ? (Number(row.vote_count) / totalDates) * 100 : 0,
    }));
  }

  /**
   * 닉네임 중복 확인
   */
  async nicknameExists(
    check: ParticipantCheckInput,
    connection?: PoolConnection
  ): Promise<boolean> {
    const poolToUse = connection || this.pool;

    const [rows] = await poolToUse.execute<RowDataPacket[]>(
      'SELECT COUNT(*) as count FROM participants WHERE calendar_id = ? AND nickname = ?',
      [check.calendar_id, check.nickname]
    );

    return rows[0].count > 0;
  }

  /**
   * 참가자 삭제
   */
  async delete(id: number, connection?: PoolConnection): Promise<boolean> {
    const poolToUse = connection || this.pool;

    const [result] = await poolToUse.execute<ResultSetHeader>(
      'DELETE FROM participants WHERE id = ?',
      [id]
    );

    return result.affectedRows > 0;
  }

  /**
   * DB row를 Participant 객체로 변환
   */
  private mapToParticipant(row: RowDataPacket): Participant {
    return {
      id: row.id,
      participant_uuid: row.participant_uuid,
      user_id: row.user_id,
      role: row.role,
      calendar_id: row.calendar_id,
      nickname: row.nickname,
      password_hash: row.password_hash,
      color_code: row.color_code,
      joined_at: new Date(row.joined_at),
    };
  }
}
