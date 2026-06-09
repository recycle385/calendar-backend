import { RequestHandler } from 'express';

import { DateKind, DateNamePair } from '../models/DateInfo';
import { IDateInfoService } from '../services/dateInfo.service';

export class DateInfoController {
  constructor(private dateInfoService: IDateInfoService) {}

  public addDateInfo: RequestHandler = async (req, res) => {
    const dateInfo = req.body;
    const resultCount = await this.dateInfoService.addDateInfo(dateInfo);
    return res.status(201).json(`${resultCount}개의 정보가 추가됐습니다.`);
  };

  public addDateInfos: RequestHandler = async (req, res) => {
    const dateInfoList = req.body.dateInfos;

    const resultCount = await this.dateInfoService.addDateInfos(dateInfoList);
    return res.status(201).json(`${resultCount}개의 정보가 추가됐습니다.`);
  };

  public getDateInfosByYear: RequestHandler = async (req, res) => {
    const year = req.params.year;
    const dateInfoList = await this.dateInfoService.getDateInfosByYear(year);
    return res.json(dateInfoList);
  };

  public getDateInfosByYears: RequestHandler = async (req, res) => {
    const years = req.query.years as string[];
    const dateInfoList = await this.dateInfoService.getDateInfosByYears(years);
    return res.json(dateInfoList);
  };

  public deleteDateInfosByYearBefore: RequestHandler = async (req, res) => {
    const year = req.query.year as string;
    const deletedCount = await this.dateInfoService.deleteDateInfosByYearBefore(year);
    return res.json(`${deletedCount}개의 정보가 삭제됐습니다.`);
  };

  public getDateInfosByYearBefore: RequestHandler = async (req, res) => {
    const year = req.query.year as string;
    const dateInfoList = await this.dateInfoService.getDateInfosByYearBefore(year);
    return res.json(dateInfoList);
  };

  public getAllDateInfos: RequestHandler = async (req, res) => {
    const dateInfoList = await this.dateInfoService.getAllDateInfos();
    return res.json(dateInfoList);
  };

  public getDateInfosByYearAndDateKinds: RequestHandler = async (req, res) => {
    const year = req.params.year;
    const dateKinds = req.query.dateKinds as DateKind[];
    const dateInfoList = await this.dateInfoService.getDateInfosByYearAndDateKinds(year, dateKinds);
    return res.json(dateInfoList);
  };

  public getDateInfosByYearsAndDateKinds: RequestHandler = async (req, res) => {
    const years = req.query.years as string[];
    const dateKinds = req.query.dateKinds as DateKind[];
    const dateInfoList = await this.dateInfoService.getDateInfosByYearsAndDateKinds(
      years,
      dateKinds
    );
    return res.json(dateInfoList);
  };

  public deleteByDatesAndNames: RequestHandler = async (req, res) => {
    const dateNamePairs = req.body.dateNamePairs;

    const deletedCount = await this.dateInfoService.deleteByDatesAndNames(dateNamePairs);
    return res.json(`${deletedCount}개의 정보가 삭제됐습니다.`);
  };
}
