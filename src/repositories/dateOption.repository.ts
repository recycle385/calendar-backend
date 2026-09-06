import { ResultSetHeader, RowDataPacket } from 'mysql2';
import { PoolConnection } from 'mysql2/promise';

import dbpool from '../config/database';
import { CreateDateOptionInput, DateOption } from '../models/DateOption';
import { formatDateOnly } from '../utils/dateOnly';
import { Errors } from '../utils/errors';

export interface IDateOptionRepository {
  create(input: CreateDateOptionInput, connection?: PoolConnection): Promise<DateOption>;
  createBatch(calendarId: number, dates: string[], connection?: PoolConnection): Promise<number>;
  findById(id: number, connection?: PoolConnection): Promise<DateOption | null>;
  findOptionsByIds(ids: number[], connection?: PoolConnection): Promise<DateOption[]>;
  findByCalendarId(calendarId: number, connection?: PoolConnection): Promise<DateOption[]>;
  findDateOptionsByCalendarAndDate(
    calendarId: number,
    dateValue: string[],
    connection?: PoolConnection
  ): Promise<DateOption[]>;
  findByCalendarAndDate(
    calendarId: number,
    dateValue: string,
    connection?: PoolConnection
  ): Promise<DateOption | null>;
  deleteOutsideRange(
    calendarId: number,
    startDate: string,
    endDate: string,
    connection?: PoolConnection
  ): Promise<number>;
  delete(id: number, connection?: PoolConnection): Promise<boolean>;
  deleteByCalendarId(calendarId: number, connection?: PoolConnection): Promise<number>;
}

export class DateOptionRepository implements IDateOptionRepository {
  constructor(private pool = dbpool) {}

  async create(input: CreateDateOptionInput, connection?: PoolConnection): Promise<DateOption> {
    const poolToUse = connection || this.pool;

    const { calendar_id, date_value, is_enabled } = input;

    const [result] = await poolToUse.execute<ResultSetHeader>(
      `INSERT INTO date_options (calendar_id, date_value, is_enabled)
       VALUES (?, ?, ?)`,
      [calendar_id, formatDateOnly(date_value), is_enabled ?? true]
    );

    const dateOption = await this.findById(result.insertId, connection);
    if (!dateOption) {
      throw Errors.Internal('날짜 옵션 생성 후 조회 실패');
    }

    return dateOption;
  }

  async createBatch(
    calendarId: number,
    dates: string[],
    connection?: PoolConnection
  ): Promise<number> {
    const poolToUse = connection || this.pool;

    if (dates.length === 0) {
      return 0;
    }

    const sortedDates = [...dates].sort();
    const values = sortedDates.map((date) => [calendarId, formatDateOnly(date), true]);

    const [result] = await poolToUse.query<ResultSetHeader>(
      `INSERT INTO date_options (calendar_id, date_value, is_enabled)
       VALUES ?
       ON DUPLICATE KEY UPDATE date_value = date_value`,
      [values]
    );

    return result.affectedRows;
  }

  async findById(id: number, connection?: PoolConnection): Promise<DateOption | null> {
    const poolToUse = connection || this.pool;

    const [rows] = await poolToUse.execute<RowDataPacket[]>(
      'SELECT * FROM date_options WHERE id = ?',
      [id]
    );

    if (rows.length === 0) {
      return null;
    }

    return this.mapToDateOption(rows[0]);
  }

  async findOptionsByIds(ids: number[], connection?: PoolConnection): Promise<DateOption[]> {
    const poolToUse = connection || this.pool;

    if (ids.length === 0) {
      return [];
    }

    const [rows] = await poolToUse.query<RowDataPacket[]>(
      'SELECT * FROM date_options WHERE id in (?)',
      [ids]
    );

    if (rows.length === 0) {
      return [];
    }

    const result = rows.map((s) => this.mapToDateOption(s));
    return result;
  }

  async findByCalendarId(calendarId: number, connection?: PoolConnection): Promise<DateOption[]> {
    const poolToUse = connection || this.pool;

    const [rows] = await poolToUse.execute<RowDataPacket[]>(
      'SELECT * FROM date_options WHERE calendar_id = ? ORDER BY date_value ASC',
      [calendarId]
    );

    return rows.map((row) => this.mapToDateOption(row));
  }

  async findDateOptionsByCalendarAndDate(
    calendarId: number,
    dateValue: string[],
    connection?: PoolConnection
  ): Promise<DateOption[]> {
    const poolToUse = connection || this.pool;

    if (dateValue.length === 0) {
      return [];
    }

    const [rows] = await poolToUse.query<RowDataPacket[]>(
      'SELECT * FROM date_options WHERE calendar_id = ? AND date_value IN (?)',
      [calendarId, dateValue]
    );

    const result = rows.map((s) => this.mapToDateOption(s));
    return result;
  }

  async findByCalendarAndDate(
    calendarId: number,
    dateValue: string,
    connection?: PoolConnection
  ): Promise<DateOption | null> {
    const poolToUse = connection || this.pool;

    const [rows] = await poolToUse.execute<RowDataPacket[]>(
      'SELECT * FROM date_options WHERE calendar_id = ? AND date_value = ?',
      [calendarId, dateValue]
    );

    if (rows.length === 0) {
      return null;
    }

    return this.mapToDateOption(rows[0]);
  }

  async deleteOutsideRange(
    calendarId: number,
    startDate: string,
    endDate: string,
    connection?: PoolConnection
  ): Promise<number> {
    const poolToUse = connection || this.pool;

    const [result] = await poolToUse.execute<ResultSetHeader>(
      `DELETE FROM date_options
       WHERE calendar_id = ?
         AND (date_value < ? OR date_value > ?)`,
      [calendarId, formatDateOnly(startDate), formatDateOnly(endDate)]
    );

    return result.affectedRows;
  }

  async delete(id: number, connection?: PoolConnection): Promise<boolean> {
    const poolToUse = connection || this.pool;

    const [result] = await poolToUse.execute<ResultSetHeader>(
      'DELETE FROM date_options WHERE id = ?',
      [id]
    );

    return result.affectedRows > 0;
  }

  async deleteByCalendarId(calendarId: number, connection?: PoolConnection): Promise<number> {
    const poolToUse = connection || this.pool;

    const [result] = await poolToUse.execute<ResultSetHeader>(
      'DELETE FROM date_options WHERE calendar_id = ?',
      [calendarId]
    );

    return result.affectedRows;
  }

  private mapToDateOption(row: RowDataPacket): DateOption {
    return {
      id: row.id,
      calendar_id: row.calendar_id,
      date_value: formatDateOnly(row.date_value),
      is_enabled: Boolean(row.is_enabled),
      created_at: new Date(row.created_at),
    };
  }
}
