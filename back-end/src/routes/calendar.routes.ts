import { Router } from 'express';

import { CALENDAR_ROUTES } from '../constants/routes.constants';
import { CalendarController } from '../controllers/calendar.controller';
import { authenticateParticipant, authenticateUser } from '../middlewares/auth';
import { asyncHandler } from '../middlewares/errorHandler';
import {
  calendarSchemas,
  slugParams,
  validateBody,
  validateParams,
} from '../middlewares/validation';

export const createCalendarRouter = (controller: CalendarController): Router => {
  const router = Router();

  /**
   * @swagger
   * /api/v1/calendars:
   *   post:
   *     summary: 새로운 캘린더 생성 (링크 생성)
   *     description: 캘린더 생성할때 방장의 닉네임도 같이 받음
   *     security:
   *       - UserAuth: []
   *     tags: [Calendar]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: "#/components/schemas/CreateCalendarRequest"
   *     responses:
   *       201:
   *         description: 캘린더 생성 성공
   *         content:
   *           application/json:
   *             schema:
   *               $ref: "#/components/schemas/CreateCalendarResponse"
   *       400:
   *         description: 필수 파라미터 필요
   *       401:
   *         description: 생성 권한 필요
   */
  router.post(
    '/',
    authenticateUser,
    validateBody(calendarSchemas.createRequest),
    asyncHandler(controller.createCalendar)
  );

  /**
   * @swagger
   * /api/v1/calendars/my:
   *   get:
   *     summary: 내 캘린더 목록 조회
   *     description: Google 로그인 필요
   *     security:
   *       - UserAuth: []
   *     tags: [Calendar]
   *     responses:
   *       200:
   *         description: 내 캘린더 목록 조회 완료
   *         content:
   *           application/json:
   *             schema:
   *               $ref: "#/components/schemas/GetMyCalendarsResponse"
   *       401:
   *         description: 로그인 필요
   *       500:
   *         description: 인증 실패
   */
  router.get(
    CALENDAR_ROUTES.MY_CALENDAR_LIST,
    authenticateUser,
    asyncHandler(controller.getMyCalendars)
  );

  /**
   * @swagger
   * /api/v1/calendars/{slug}:
   *   get:
   *     summary: Slug로 캘린더 조회
   *     description: 인증 불필요
   *     tags: [Calendar]
   *     parameters:
   *       - in: path
   *         name: slug
   *         required: true
   *         description: "캘린더의 고유 식별 토큰 (예: Ab3dE9xR)"
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: 캘린더 조회 완료
   *         content:
   *           application/json:
   *             schema:
   *               $ref: "#/components/schemas/CommonCalendarResponse"
   *       400:
   *         description: slug가 없음
   *       404:
   *         description: 캘린더가 없음
   */
  router.get(
    CALENDAR_ROUTES.CALENDAR_SLUG,
    validateParams(slugParams),
    asyncHandler(controller.getCalendarBySlug)
  );

  /**
   * @swagger
   * /api/v1/calendars/{slug}:
   *   patch:
   *     summary: 캘린더 정보 수정
   *     description: 방장만 수정 가능
   *     security:
   *       - ParticipantAuth: []
   *     parameters:
   *       - in: path
   *         name: slug
   *         required: true
   *         description: "캘린더의 고유 식별 토큰 (예: Ab3dE9xR)"
   *         schema:
   *           type: string
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: "#/components/schemas/UpdateCalendarRequest"
   *     responses:
   *       200:
   *         description: 수정완료
   *         content:
   *           application/json:
   *             schema:
   *               oneOf:
   *                 - $ref: "#/components/schemas/DefaultResponseDto"
   *                 - $ref: "#/components/schemas/CommonCalendarResponse"
   *       500:
   *         description: 토큰 인증 실패
   *       400:
   *         description: slug가 없음
   *       403:
   *         description: 방장만 수정가능
   */
  router.patch(
    CALENDAR_ROUTES.CALENDAR_SLUG,
    validateParams(slugParams),
    validateBody(calendarSchemas.updateRequest),
    authenticateParticipant,
    asyncHandler(controller.updateCalendar)
  );

  /**
   * @swagger
   * /api/v1/calendars/{slug}:
   *   delete:
   *     summary: 캘린더 삭제
   *     description: 방장만 가능
   *     security:
   *       - ParticipantAuth: []
   *     parameters:
   *       - in: path
   *         name: slug
   *         required: true
   *         description: "캘린더의 고유 식별 토큰 (예 Ab3dE9xR)"
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: 삭제완료
   *         content:
   *           application/json:
   *             schema:
   *               $ref: "#/components/schemas/DefaultResponseDto"
   *       500:
   *         description: 인증실패
   *       400:
   *         description: slug가 없음
   *       403:
   *         description: 방장만 가능
   */
  router.delete(
    CALENDAR_ROUTES.CALENDAR_SLUG,
    validateParams(slugParams),
    authenticateParticipant,
    asyncHandler(controller.deleteCalendar)
  );

  /**
   * @swagger
   * /api/v1/calendars/{slug}/close:
   *   post:
   *     summary: 캘린더 마감
   *     description: 방장만 가능
   *     security:
   *       - ParticipantAuth: []
   *     parameters:
   *       - in: path
   *         name: slug
   *         required: true
   *         description: "캘린더의 고유 식별 토큰 (예: Ab3dE9xR)"
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: 캘린더 마감 완료
   *         content:
   *           application/json:
   *             schema:
   *               $ref: "#/components/schemas/CommonCalendarResponse"
   *       500:
   *         description: 토큰 인증 실패
   *       400:
   *         description: slug가 없음
   *       403:
   *         description: 방장만 마감 가능
   */
  router.post(
    CALENDAR_ROUTES.CALENDAR_CLOSE,
    validateParams(slugParams),
    authenticateParticipant,
    asyncHandler(controller.closeCalendar)
  );

  return router;
};
