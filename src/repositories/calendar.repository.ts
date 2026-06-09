import { ResultSetHeader, RowDataPacket } from 'mysql2';
import { PoolConnection } from 'mysql2/promise';

import dbpool from '../config/database';
import { Calendar, CreateCalendarInput, UpdateCalendarInput } from '../models/Calendar';
import { CalendarWithHostUuid } from '../models/Calendar';
import { DateOnlyInput, formatDateOnly, todayDateOnlyUtc } from '../utils/dateOnly';
import { Errors } from '../utils/errors';
import { formatUtcDateTimeForSql } from '../utils/utcDate';

export interface ICalendarRepository {
  create(input: CreateCalendarInput, connection?: PoolConnection): Promise<Calendar>;
  findById(id: number, connection?: PoolConnection): Promise<Calendar | null>;
  findBySlug(slug: string, connection?: PoolConnection): Promise<Calendar | null>;
  findByOwnerId(ownerId: number, connection?: PoolConnection): Promise<Calendar[]>;
  getIdUsingSlug(slug: string, connection?: PoolConnection): Promise<number>;
  update(id: number, input: UpdateCalendarInput, connection?: PoolConnection): Promise<boolean>;
  delete(id: number, connection?: PoolConnection): Promise<boolean>;
  deleteByIds(ids: number[], connection?: PoolConnection): Promise<number>;
  close(id: number, connection?: PoolConnection): Promise<boolean>;
  closeByIds(ids: number[], connection?: PoolConnection): Promise<number>;
  getCalAndPUuidDatasByUserIds(
    user_id: number,
    connection?: PoolConnection
  ): Promise<CalendarWithHostUuid[]>;
  slugExists(slug: string, connection?: PoolConnection): Promise<boolean>;
  findEndedAndOpen(connection?: PoolConnection, referenceDate?: DateOnlyInput): Promise<Calendar[]>;
  findExpired(connection?: PoolConnection, referenceTime?: Date): Promise<Calendar[]>;
}

export class CalendarRepository implements ICalendarRepository {
  constructor(private pool = dbpool) {}

  /**
   * 새로운 캘린더 생성
   */
  async create(input: CreateCalendarInput, connection?: PoolConnection): Promise<Calendar> {
    const poolToUse = connection || this.pool;

    const { slug, title, description, start_date, end_date, owner_id, expired_at } = input;

    const [result] = await poolToUse.execute<ResultSetHeader>(
      `INSERT INTO calendars (slug, title, description, start_date, end_date, owner_id, expired_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        slug,
        title,
        description || null,
        formatDateOnly(start_date),
        formatDateOnly(end_date),
        owner_id,
        expired_at,
      ]
    );

    const calendar = await this.findById(result.insertId, connection);
    if (!calendar) {
      throw Errors.Internal('캘린더 생성 후 조회 실패');
    }

    return calendar;
  }

  /**
   * ID로 캘린더 조회
   */
  async findById(id: number, connection?: PoolConnection): Promise<Calendar | null> {
    const poolToUse = connection || this.pool;

    const [rows] = await poolToUse.execute<RowDataPacket[]>(
      'SELECT * FROM calendars WHERE id = ?',
      [id]
    );

    if (rows.length === 0) {
      return null;
    }

    return this.mapToCalendar(rows[0]);
  }

  /**
   * Slug로 캘린더 조회
   */
  async findBySlug(slug: string, connection?: PoolConnection): Promise<Calendar | null> {
    const poolToUse = connection || this.pool;

    const [rows] = await poolToUse.execute<RowDataPacket[]>(
      'SELECT * FROM calendars WHERE slug = ?',
      [slug]
    );

    if (rows.length === 0) {
      return null;
    }

    return this.mapToCalendar(rows[0]);
  }

  async getIdUsingSlug(slug: string, connection?: PoolConnection): Promise<number> {
    const poolToUse = connection || this.pool;

    const [rows] = await poolToUse.execute<RowDataPacket[]>(
      'select id from calendars where slug = ?',
      [slug]
    );

    if (rows.length === 0) {
      throw Errors.NotFound('유저 조회 실패');
    }

    return rows[0].id;
  }

  /**
   * 소유자 ID로 캘린더 목록 조회
   */
  async findByOwnerId(ownerId: number, connection?: PoolConnection): Promise<Calendar[]> {
    const poolToUse = connection || this.pool;

    const [rows] = await poolToUse.execute<RowDataPacket[]>(
      'SELECT * FROM calendars WHERE owner_id = ? ORDER BY created_at DESC',
      [ownerId]
    );

    return rows.map((row) => this.mapToCalendar(row));
  }

  /**
   * 캘린더 정보 수정
   */
  async update(
    id: number,
    input: UpdateCalendarInput,
    connection?: PoolConnection
  ): Promise<boolean> {
    const poolToUse = connection || this.pool;

    const updates: string[] = [];
    const values: any[] = [];

    if (input.title !== undefined) {
      updates.push('title = ?');
      values.push(input.title);
    }

    if (input.description !== undefined) {
      updates.push('description = ?');
      values.push(input.description);
    }

    if (input.start_date !== undefined) {
      updates.push('start_date = ?');
      values.push(formatDateOnly(input.start_date));
    }

    if (input.end_date !== undefined) {
      updates.push('end_date = ?');
      values.push(formatDateOnly(input.end_date));
    }

    if (input.is_closed !== undefined) {
      updates.push('is_closed = ?');
      values.push(input.is_closed);
    }

    if (input.expired_at !== undefined) {
      updates.push('expired_at = ?');
      values.push(input.expired_at);
    }

    if (updates.length === 0) {
      return false;
    }

    values.push(id);

    const [result] = await poolToUse.execute<ResultSetHeader>(
      `UPDATE calendars SET ${updates.join(', ')} WHERE id = ?`,
      values
    );

    return result.affectedRows > 0;
  }

  /**
   * 캘린더 삭제
   */
  async delete(id: number, connection?: PoolConnection): Promise<boolean> {
    const poolToUse = connection || this.pool;

    const [result] = await poolToUse.execute<ResultSetHeader>(
      'DELETE FROM calendars WHERE id = ?',
      [id]
    );

    return result.affectedRows > 0;
  }

  async deleteByIds(ids: number[], connection?: PoolConnection): Promise<number> {
    const poolToUse = connection || this.pool;

    const [result] = await poolToUse.query<ResultSetHeader>(
      'DELETE FROM calendars WHERE id IN (?)',
      [ids]
    );

    return result.affectedRows;
  }

  /**
   * 캘린더 마감 (투표 종료)
   */
  async close(id: number, connection?: PoolConnection): Promise<boolean> {
    const poolToUse = connection || this.pool;

    const [result] = await poolToUse.execute<ResultSetHeader>(
      'UPDATE calendars SET is_closed = TRUE WHERE id = ?',
      [id]
    );

    return result.affectedRows > 0;
  }

  async closeByIds(ids: number[], connection?: PoolConnection): Promise<number> {
    const poolToUse = connection || this.pool;

    const [result] = await poolToUse.query<ResultSetHeader>(
      'UPDATE calendars SET is_closed = TRUE WHERE id IN (?)',
      [ids]
    );

    return result.affectedRows;
  }

  /**
   * Slug 중복 확인
   */
  async slugExists(slug: string, connection?: PoolConnection): Promise<boolean> {
    const poolToUse = connection || this.pool;

    const [rows] = await poolToUse.execute<RowDataPacket[]>(
      'SELECT COUNT(*) as count FROM calendars WHERE slug = ?',
      [slug]
    );

    return rows[0].count > 0;
  }

  async findEndedAndOpen(
    connection?: PoolConnection,
    referenceDate: DateOnlyInput = todayDateOnlyUtc()
  ): Promise<Calendar[]> {
    const poolToUse = connection || this.pool;

    const [rows] = await poolToUse.execute<RowDataPacket[]>(
      'SELECT * FROM calendars WHERE is_closed = FALSE AND end_date < ?',
      [formatDateOnly(referenceDate)]
    );

    return rows.map((row) => this.mapToCalendar(row));
  }

  async findExpired(connection?: PoolConnection, referenceTime = new Date()): Promise<Calendar[]> {
    const poolToUse = connection || this.pool;

    const [rows] = await poolToUse.execute<RowDataPacket[]>(
      'SELECT id FROM calendars WHERE expired_at < ?',
      [formatUtcDateTimeForSql(referenceTime)]
    );

    return rows.map((row) => this.mapToCalendar(row));
  }

  async getCalAndPUuidDatasByUserIds(
    user_id: number,
    connection?: PoolConnection
  ): Promise<CalendarWithHostUuid[]> {
    const poolToUse = connection || this.pool;

    const [rows] = await poolToUse.query<RowDataPacket[]>(
      ` SELECT c.*, p.participant_uuid AS hostParticipantUuid 
        FROM calendars AS c 
        JOIN participants AS p ON c.id = p.calendar_id 
        WHERE p.role = 'host' AND p.user_id = ?`,
      [user_id]
    );

    if (rows.length === 0) {
      return [];
    }

    return rows.map((row) => this.mapToCalWithPUuid(row));
  }

  /**
   * DB row를 Calendar 객체로 변환
   */
  private mapToCalendar(row: RowDataPacket): Calendar {
    return {
      id: row.id,
      slug: row.slug,
      title: row.title,
      description: row.description,
      start_date: formatDateOnly(row.start_date),
      end_date: formatDateOnly(row.end_date),
      is_closed: Boolean(row.is_closed),
      owner_id: row.owner_id,
      created_at: new Date(row.created_at),
      expired_at: new Date(row.expired_at),
    };
  }

  private mapToCalWithPUuid(row: RowDataPacket): CalendarWithHostUuid {
    return {
      ...this.mapToCalendar(row),
      hostParticipantUuid: row.hostParticipantUuid,
    };
  }
}
