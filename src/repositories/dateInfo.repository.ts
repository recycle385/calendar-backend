import { ResultSetHeader, RowDataPacket } from 'mysql2';
import { PoolConnection } from 'mysql2/promise';

import dbpool from '../config/database';
import { DataSource, DateInfo, DateKind, DateNamePair, SafeDateInfo } from '../models/DateInfo';
import { formatDateOnly, parseDateOnlyToUtcDate } from '../utils/dateOnly';
import { Errors } from '../utils/errors';

export interface IDateInfoRepository {
  insertDateInfos(dateInfoList: SafeDateInfo[], connection?: PoolConnection): Promise<number>;
  findByIds(ids: number[], connection?: PoolConnection): Promise<DateInfo[]>;
  findByYears(years: string[], connection?: PoolConnection): Promise<DateInfo[]>;
  findByYearBefore(year: string, connection?: PoolConnection): Promise<DateInfo[]>;
  deleteByIds(ids: number[], connection?: PoolConnection): Promise<number>;
  deleteByYearBefore(year: string, connection?: PoolConnection): Promise<number>;
  getAllDateInfosByDateKinds(
    datekinds: DateKind[],
    connection?: PoolConnection
  ): Promise<DateInfo[]>;
  getAllDateInfos(connection?: PoolConnection): Promise<DateInfo[]>;
  getDateInfosByYearsAndDateKinds(
    years: string[],
    datekinds: DateKind[],
    connection?: PoolConnection
  ): Promise<DateInfo[]>;
  deleteByDatesAndNames(
    dateNamePairs: DateNamePair[],
    connection?: PoolConnection
  ): Promise<number>;
  getIdsByDatesAndNames(
    dateNamePairs: DateNamePair[],
    connection?: PoolConnection
  ): Promise<number[]>;
}

export class DateInfoRepository implements IDateInfoRepository {
  constructor(private pool = dbpool) {}

  async insertDateInfos(
    dateInfoList: SafeDateInfo[],
    connection?: PoolConnection
  ): Promise<number> {
    const poolToUse = connection || this.pool;

    const values = dateInfoList.map(
      ({ locationDate, year, seq, dateName, dateKind, isHoliday, dataSource }) => {
        const loc = formatDateOnly(locationDate);
        return [loc, year, seq, dateName, dateKind, isHoliday, dataSource];
      }
    );

    const [result] = await poolToUse.query<ResultSetHeader>(
      `INSERT INTO date_info (location_date, year, seq, date_name, date_kind, is_holiday, data_source)
    VALUES ?`,
      [values]
    );

    return result.affectedRows;
  }

  async findByIds(ids: number[], connection?: PoolConnection): Promise<DateInfo[]> {
    const poolToUse = connection || this.pool;

    if (ids.length === 0) {
      return [];
    }

    const [rows] = await poolToUse.query<RowDataPacket[]>(
      `SELECT * FROM date_info WHERE id IN (?)`,
      [ids]
    );

    return rows.map((row) => this.mapToDateInfo(row));
  }

  async findByYears(years: string[], connection?: PoolConnection): Promise<DateInfo[]> {
    const poolToUse = connection || this.pool;

    if (years.length === 0) {
      return [];
    }

    const [rows] = await poolToUse.query<RowDataPacket[]>(
      `SELECT * FROM date_info WHERE year IN (?) ORDER BY year ASC, seq ASC`,
      [years]
    );

    return rows.map((row) => this.mapToDateInfo(row));
  }

  async findByYearBefore(year: string, connection?: PoolConnection): Promise<DateInfo[]> {
    const poolToUse = connection || this.pool;

    const [rows] = await poolToUse.execute<RowDataPacket[]>(
      `SELECT * FROM date_info WHERE year < ? ORDER BY year ASC, seq ASC`,
      [year]
    );

    return rows.map((row) => this.mapToDateInfo(row));
  }

  async deleteByIds(ids: number[], connection?: PoolConnection): Promise<number> {
    const poolToUse = connection || this.pool;

    if (ids.length === 0) {
      return 0;
    }

    const [result] = await poolToUse.query<ResultSetHeader>(
      `DELETE FROM date_info WHERE id IN (?)`,
      [ids]
    );

    return result.affectedRows;
  }

  async deleteByDatesAndNames(
    dateNamePairs: DateNamePair[],
    connection?: PoolConnection
  ): Promise<number> {
    const poolToUse = connection || this.pool;

    if (dateNamePairs.length === 0) {
      return 0;
    }

    const [result] = await poolToUse.query<ResultSetHeader>(
      `DELETE FROM date_info WHERE (location_date, date_name) IN (?)`,
      [dateNamePairs.map(({ locationDate, dateName }) => [formatDateOnly(locationDate), dateName])]
    );

    return result.affectedRows;
  }

  async deleteByYearBefore(year: string, connection?: PoolConnection): Promise<number> {
    const poolToUse = connection || this.pool;

    const [result] = await poolToUse.execute<ResultSetHeader>(
      `DELETE FROM date_info WHERE year < ?`,
      [year]
    );

    return result.affectedRows;
  }

  async getAllDateInfosByDateKinds(
    datekinds: DateKind[],
    connection?: PoolConnection
  ): Promise<DateInfo[]> {
    const poolToUse = connection || this.pool;

    if (datekinds.length === 0) {
      return [];
    }

    const [rows] = await poolToUse.query<RowDataPacket[]>(
      `SELECT * FROM date_info WHERE date_kind IN (?) ORDER BY year ASC, seq ASC`,
      [datekinds]
    );

    return rows.map((row) => this.mapToDateInfo(row));
  }

  async getAllDateInfos(connection?: PoolConnection): Promise<DateInfo[]> {
    const poolToUse = connection || this.pool;

    const [rows] = await poolToUse.execute<RowDataPacket[]>(
      `SELECT * FROM date_info ORDER BY year ASC, seq ASC`
    );

    return rows.map((row) => this.mapToDateInfo(row));
  }

  async getDateInfosByYearsAndDateKinds(
    years: string[],
    datekinds: DateKind[],
    connection?: PoolConnection
  ): Promise<DateInfo[]> {
    const poolToUse = connection || this.pool;

    if (years.length === 0 || datekinds.length === 0) {
      return [];
    }

    const [rows] = await poolToUse.query<RowDataPacket[]>(
      `SELECT * FROM date_info WHERE year IN (?) AND date_kind IN (?) ORDER BY year ASC, seq ASC`,
      [years, datekinds]
    );

    return rows.map((row) => this.mapToDateInfo(row));
  }

  async getIdsByDatesAndNames(
    dateNamePairs: DateNamePair[],
    connection?: PoolConnection
  ): Promise<number[]> {
    const poolToUse = connection || this.pool;

    if (dateNamePairs.length === 0) {
      return [];
    }

    const [rows] = await poolToUse.query<RowDataPacket[]>(
      `SELECT id FROM date_info WHERE (location_date, date_name) IN (?)`,
      [dateNamePairs.map(({ locationDate, dateName }) => [formatDateOnly(locationDate), dateName])]
    );

    return rows.map((row) => row.id);
  }

  private mapToDateInfo(row: RowDataPacket): DateInfo {
    return {
      id: row.id,
      locationDate: parseDateOnlyToUtcDate(row.location_date),
      year: row.year,
      seq: row.seq,
      dateName: row.date_name,
      dateKind: row.date_kind as DateKind,
      isHoliday: Boolean(row.is_holiday),
      dataSource: row.data_source as DataSource,
      updatedAt: new Date(row.updated_at),
    };
  }
}
