import { TransactionManager } from '../infrastructure/transaction.manager';
import {
  DateInfo,
  DateInfoMapByYear,
  DateKind,
  DateNamePair,
  SafeDateInfo,
  SafeDateInfoForResponse,
} from '../models/DateInfo';
import { IDateInfoRepository } from '../repositories/dateInfo.repository';
import { Errors } from '../utils/errors';
import { formatKstDateOnly } from '../utils/utcDate';

export interface IDateInfoService {
  addDateInfo(dateInfo: SafeDateInfo): Promise<number>;
  addDateInfos(dateInfoList: SafeDateInfo[]): Promise<number>;
  getDateInfosByYear(year: string): Promise<SafeDateInfoForResponse[]>;
  getDateInfosByYears(years: string[]): Promise<DateInfoMapByYear>;
  deleteDateInfosByYearBefore(year: string): Promise<number>;
  getDateInfosByYearBefore(year: string): Promise<DateInfoMapByYear>;
  getAllDateInfos(): Promise<DateInfoMapByYear>;
  getDateInfosByDateKind(dateKind: DateKind): Promise<SafeDateInfoForResponse[]>;
  getDateInfosByDateKinds(dateKinds: DateKind[]): Promise<SafeDateInfoForResponse[]>;
  getDateInfosByYearsAndDateKinds(
    years: string[],
    dateKinds: DateKind[]
  ): Promise<DateInfoMapByYear>;
  getDateInfosByYearAndDateKinds(
    year: string,
    dateKinds: DateKind[]
  ): Promise<SafeDateInfoForResponse[]>;
  deleteByDatesAndNames(dateNamePairs: DateNamePair[]): Promise<number>;
}

export class DateInfoService implements IDateInfoService {
  constructor(private dateInfoRepository: IDateInfoRepository) {}

  async addDateInfo(dateInfo: SafeDateInfo): Promise<number> {
    const result = await this.dateInfoRepository.insertDateInfos([dateInfo]);
    if (result !== 1) {
      throw Errors.Internal('정보가 정상적으로 추가되지 않았습니다.');
    }
    return result;
  }

  async addDateInfos(dateInfoList: SafeDateInfo[]): Promise<number> {
    const beforeCount = dateInfoList.length;
    const afterCount = await this.dateInfoRepository.insertDateInfos(dateInfoList);

    if (beforeCount !== afterCount) {
      throw Errors.Internal('정보가 정상적으로 추가되지 않았습니다.');
    }

    return afterCount;
  }

  async getDateInfosByYear(year: string): Promise<SafeDateInfoForResponse[]> {
    const result = await this.dateInfoRepository.findByYears([year]);
    return result.map((dateInfo) => this.changeToSafeDateInfo(dateInfo));
  }

  async getDateInfosByYears(years: string[]): Promise<DateInfoMapByYear> {
    const findByYearsResult = await this.dateInfoRepository.findByYears(years);
    return this.groupDateInfoByYear(years, findByYearsResult);
  }

  async deleteDateInfosByYearBefore(year: string): Promise<number> {
    return this.dateInfoRepository.deleteByYearBefore(year);
  }

  async getDateInfosByYearBefore(year: string): Promise<DateInfoMapByYear> {
    const result = await this.dateInfoRepository.findByYearBefore(year);

    const yearsBefore = Array.from(new Set(result.map((dateInfo) => dateInfo.year)));

    return this.groupDateInfoByYear(yearsBefore, result);
  }

  async getAllDateInfos(): Promise<DateInfoMapByYear> {
    const result = await this.dateInfoRepository.getAllDateInfos();

    const yearslist = Array.from(new Set(result.map((dateInfo) => dateInfo.year)));

    return this.groupDateInfoByYear(yearslist, result);
  }

  async getDateInfosByDateKind(dateKind: DateKind): Promise<SafeDateInfoForResponse[]> {
    const result = await this.dateInfoRepository.getAllDateInfosByDateKinds([dateKind]);
    return result.map((dateInfo) => this.changeToSafeDateInfo(dateInfo));
  }

  async getDateInfosByDateKinds(dateKinds: DateKind[]): Promise<SafeDateInfoForResponse[]> {
    const result = await this.dateInfoRepository.getAllDateInfosByDateKinds(dateKinds);
    return result.map((dateInfo) => this.changeToSafeDateInfo(dateInfo));
  }

  async getDateInfosByYearsAndDateKinds(
    years: string[],
    dateKinds: DateKind[]
  ): Promise<DateInfoMapByYear> {
    const result = await this.dateInfoRepository.getDateInfosByYearsAndDateKinds(years, dateKinds);
    return this.groupDateInfoByYear(years, result);
  }

  async getDateInfosByYearAndDateKinds(
    year: string,
    dateKinds: DateKind[]
  ): Promise<SafeDateInfoForResponse[]> {
    const result = await this.dateInfoRepository.getDateInfosByYearsAndDateKinds([year], dateKinds);
    return result.map((dateInfo) => this.changeToSafeDateInfo(dateInfo));
  }

  async deleteByDatesAndNames(dateNamePairs: DateNamePair[]): Promise<number> {
    return TransactionManager.run(async (con) => {
      const ids = await this.dateInfoRepository.getIdsByDatesAndNames(dateNamePairs, con);

      if (ids.length === 0) {
        return 0;
      }

      const beforeCount = ids.length;

      const deletedCount = await this.dateInfoRepository.deleteByIds(ids, con);

      if (beforeCount !== deletedCount) {
        throw Errors.Internal('삭제된 정보의 개수가 일치하지 않습니다.');
      }
      return deletedCount;
    });
  }

  private changeToSafeDateInfo(dateInfo: DateInfo): SafeDateInfoForResponse {
    return {
      locationDate: formatKstDateOnly(dateInfo.locationDate),
      year: dateInfo.year,
      seq: dateInfo.seq,
      dateName: dateInfo.dateName,
      dateKind: dateInfo.dateKind,
      isHoliday: dateInfo.isHoliday,
      dataSource: dateInfo.dataSource,
      updatedAt: dateInfo.updatedAt,
    };
  }

  private groupDateInfoByYear(years: string[], dateInfoList: DateInfo[]): DateInfoMapByYear {
    const dateInfoMapByYear: DateInfoMapByYear = {};

    years.forEach((year) => {
      dateInfoMapByYear[year] = [];
    });

    dateInfoList.forEach((dateInfo) => {
      dateInfoMapByYear[dateInfo.year].push(this.changeToSafeDateInfo(dateInfo));
    });
    return dateInfoMapByYear;
  }
}
