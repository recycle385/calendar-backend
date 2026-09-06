import { Router } from 'express';

import { DATE_INFO_ROUTES } from '../constants/routes.constants';
import { DateInfoController } from '../controllers/dateInfo.controller';
import { authenticateOperator } from '../middlewares/auth';
import { asyncHandler } from '../middlewares/errorHandler';
import {
  dateInfoSchemas,
  validateBody,
  validateParams,
  validateQuery,
} from '../middlewares/validation';

export const createDateInfoRouter = (controller: DateInfoController): Router => {
  const router = Router();

  /**
   * @swagger
   * /api/v1/date-infos:
   *   post:
   *     summary: 공휴일/기념일 단건 등록
   *     description: 운영자가 직접 입력하는 custom date-info만 등록할 수 있습니다.
   *     tags: [DateInfo]
   *     security:
   *       - OperatorAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: "#/components/schemas/AddDateInfoRequest"
   *     responses:
   *       201:
   *         description: 등록 성공
   *         content:
   *           application/json:
   *             schema:
   *               type: string
   *               example: "1개의 정보가 추가됐습니다."
   *       400:
   *         description: 요청 검증 실패
   *       401:
   *         description: 운영자 인증 필요
   *       403:
   *         description: 운영자 인증 실패
   */
  router.post(
    DATE_INFO_ROUTES.CREATE,
    authenticateOperator,
    validateBody(dateInfoSchemas.createRequest),
    asyncHandler(controller.addDateInfo)
  );

  /**
   * @swagger
   * /api/v1/date-infos/batch:
   *   post:
   *     summary: 공휴일/기념일 배치 등록
   *     description: 운영자가 직접 입력하는 custom date-info를 여러 건 등록합니다.
   *     tags: [DateInfo]
   *     security:
   *       - OperatorAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: "#/components/schemas/AddDateInfosRequest"
   *     responses:
   *       201:
   *         description: 등록 성공
   *         content:
   *           application/json:
   *             schema:
   *               type: string
   *               example: "2개의 정보가 추가됐습니다."
   *       400:
   *         description: 요청 검증 실패
   *       401:
   *         description: 운영자 인증 필요
   *       403:
   *         description: 운영자 인증 실패
   */
  router.post(
    DATE_INFO_ROUTES.CREATE_BATCH,
    authenticateOperator,
    validateBody(dateInfoSchemas.createBatchRequest),
    asyncHandler(controller.addDateInfos)
  );

  /**
   * @swagger
   * /api/v1/date-infos:
   *   get:
   *     summary: 전체 공휴일/기념일 조회
   *     tags: [DateInfo]
   *     responses:
   *       200:
   *         description: 연도별 date-info map
   *         content:
   *           application/json:
   *             schema:
   *               $ref: "#/components/schemas/DateInfoMapByYear"
   */
  router.get(DATE_INFO_ROUTES.GET_ALL, asyncHandler(controller.getAllDateInfos));

  /**
   * @swagger
   * /api/v1/date-infos/years:
   *   get:
   *     summary: 여러 연도 공휴일/기념일 조회
   *     tags: [DateInfo]
   *     parameters:
   *       - in: query
   *         name: years
   *         required: true
   *         schema:
   *           type: array
   *           minItems: 1
   *           items:
   *             type: string
   *             pattern: "^\\d{4}$"
   *         style: form
   *         explode: true
   *         example: ["2025", "2026"]
   *     responses:
   *       200:
   *         description: 요청한 연도별 date-info map
   *         content:
   *           application/json:
   *             schema:
   *               $ref: "#/components/schemas/DateInfoMapByYear"
   *       400:
   *         description: query 검증 실패
   */
  router.get(
    DATE_INFO_ROUTES.GET_BY_YEARS,
    validateQuery(dateInfoSchemas.yearsQuery),
    asyncHandler(controller.getDateInfosByYears)
  );

  /**
   * @swagger
   * /api/v1/date-infos/before:
   *   get:
   *     summary: 특정 연도 이전 공휴일/기념일 조회
   *     tags: [DateInfo]
   *     parameters:
   *       - in: query
   *         name: year
   *         required: true
   *         schema:
   *           type: string
   *           pattern: "^\\d{4}$"
   *         example: "2026"
   *     responses:
   *       200:
   *         description: 기준 연도 이전 date-info map
   *         content:
   *           application/json:
   *             schema:
   *               $ref: "#/components/schemas/DateInfoMapByYear"
   *       400:
   *         description: query 검증 실패
   */
  router.get(
    DATE_INFO_ROUTES.GET_BEFORE,
    validateQuery(dateInfoSchemas.yearQuery),
    asyncHandler(controller.getDateInfosByYearBefore)
  );

  /**
   * @swagger
   * /api/v1/date-infos/kinds:
   *   get:
   *     summary: 여러 연도와 날짜 종류로 공휴일/기념일 조회
   *     tags: [DateInfo]
   *     parameters:
   *       - in: query
   *         name: years
   *         required: true
   *         schema:
   *           type: array
   *           minItems: 1
   *           items:
   *             type: string
   *             pattern: "^\\d{4}$"
   *         style: form
   *         explode: true
   *         example: ["2025", "2026"]
   *       - in: query
   *         name: dateKinds
   *         required: true
   *         schema:
   *           type: array
   *           minItems: 1
   *           items:
   *             $ref: "#/components/schemas/DateKind"
   *         style: form
   *         explode: true
   *         example: ["01", "03"]
   *     responses:
   *       200:
   *         description: 요청한 연도별 date-info map
   *         content:
   *           application/json:
   *             schema:
   *               $ref: "#/components/schemas/DateInfoMapByYear"
   *       400:
   *         description: query 검증 실패
   */
  router.get(
    DATE_INFO_ROUTES.GET_BY_YEARS_AND_KINDS,
    validateQuery(dateInfoSchemas.yearsAndKindsQuery),
    asyncHandler(controller.getDateInfosByYearsAndDateKinds)
  );

  /**
   * @swagger
   * /api/v1/date-infos/{year}/kinds:
   *   get:
   *     summary: 특정 연도와 날짜 종류로 공휴일/기념일 조회
   *     tags: [DateInfo]
   *     parameters:
   *       - in: path
   *         name: year
   *         required: true
   *         schema:
   *           type: string
   *           pattern: "^\\d{4}$"
   *         example: "2026"
   *       - in: query
   *         name: dateKinds
   *         required: true
   *         schema:
   *           type: array
   *           minItems: 1
   *           items:
   *             $ref: "#/components/schemas/DateKind"
   *         style: form
   *         explode: true
   *         example: ["01", "03"]
   *     responses:
   *       200:
   *         description: date-info 배열
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items:
   *                 $ref: "#/components/schemas/SafeDateInfoDto"
   *       400:
   *         description: params 또는 query 검증 실패
   */
  router.get(
    DATE_INFO_ROUTES.GET_BY_YEAR_AND_KINDS,
    validateParams(dateInfoSchemas.yearParams),
    validateQuery(dateInfoSchemas.yearKindsQuery),
    asyncHandler(controller.getDateInfosByYearAndDateKinds)
  );

  /**
   * @swagger
   * /api/v1/date-infos/{year}:
   *   get:
   *     summary: 특정 연도 공휴일/기념일 조회
   *     tags: [DateInfo]
   *     parameters:
   *       - in: path
   *         name: year
   *         required: true
   *         schema:
   *           type: string
   *           pattern: "^\\d{4}$"
   *         example: "2026"
   *     responses:
   *       200:
   *         description: date-info 배열
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items:
   *                 $ref: "#/components/schemas/SafeDateInfoDto"
   *       400:
   *         description: params 검증 실패
   */
  router.get(
    DATE_INFO_ROUTES.GET_BY_YEAR,
    validateParams(dateInfoSchemas.yearParams),
    asyncHandler(controller.getDateInfosByYear)
  );

  /**
   * @swagger
   * /api/v1/date-infos/before:
   *   delete:
   *     summary: 특정 연도 이전 공휴일/기념일 삭제
   *     tags: [DateInfo]
   *     security:
   *       - OperatorAuth: []
   *     parameters:
   *       - in: query
   *         name: year
   *         required: true
   *         schema:
   *           type: string
   *           pattern: "^\\d{4}$"
   *         example: "2023"
   *     responses:
   *       200:
   *         description: 삭제 성공
   *         content:
   *           application/json:
   *             schema:
   *               type: string
   *               example: "10개의 정보가 삭제됐습니다."
   *       400:
   *         description: query 검증 실패
   *       401:
   *         description: 운영자 인증 필요
   *       403:
   *         description: 운영자 인증 실패
   */
  router.delete(
    DATE_INFO_ROUTES.DELETE_BEFORE,
    authenticateOperator,
    validateQuery(dateInfoSchemas.yearQuery),
    asyncHandler(controller.deleteDateInfosByYearBefore)
  );

  /**
   * @swagger
   * /api/v1/date-infos:
   *   delete:
   *     summary: 날짜/이름 쌍으로 공휴일/기념일 삭제
   *     tags: [DateInfo]
   *     security:
   *       - OperatorAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: "#/components/schemas/DeleteDateInfoPairsRequest"
   *     responses:
   *       200:
   *         description: 삭제 성공
   *         content:
   *           application/json:
   *             schema:
   *               type: string
   *               example: "2개의 정보가 삭제됐습니다."
   *       400:
   *         description: 요청 검증 실패
   *       401:
   *         description: 운영자 인증 필요
   *       403:
   *         description: 운영자 인증 실패
   */
  router.delete(
    DATE_INFO_ROUTES.DELETE_BY_DATES_AND_NAMES,
    authenticateOperator,
    validateBody(dateInfoSchemas.deleteByDatesAndNamesRequest),
    asyncHandler(controller.deleteByDatesAndNames)
  );
  return router;
};
