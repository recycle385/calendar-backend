import { Router } from 'express';

import { env } from '../config/env';
import { PARTICIPANT_ROUTES } from '../constants/routes.constants';
import { ParticipantController } from '../controllers/participant.controller';
import { authRateLimiter, optionalAuth } from '../middlewares';
import { authenticateParticipant } from '../middlewares/auth';
import { asyncHandler } from '../middlewares/errorHandler';
import {
  commonSchemas,
  participantSchemas,
  slugParams,
  validateBody,
  validateParams,
} from '../middlewares/validation';

export const createParticipantRouter = (controller: ParticipantController): Router => {
  const router = Router({ mergeParams: true });

  /**
   * @swagger
   * /api/v1/calendars/{slug}/participants:
   *   post:
   *     summary: 참가자 등록 (회원가입)
   *     description: "회원은 닉네임만, 비회원(게스트)은 닉네임과 비밀번호가 필요합니다. 마감된 캘린더는 참가할 수 없습니다."
   *     security:
   *       - UserAuth: []
   *       - {}
   *     tags: [participant]
   *     parameters:
   *       - in: path
   *         name: slug
   *         required: true
   *         description: "캘린더의 고유 식별 토큰"
   *         schema:
   *           type: string
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: "#/components/schemas/RegisterParticipantRequest"
   *     responses:
   *       201:
   *         description: 참가자 등록 성공
   *         content:
   *           application/json:
   *             schema:
   *               $ref: "#/components/schemas/RegisterParticipantResponse"
   *       400:
   *         description: "잘못된 요청 (이미 마감된 캘린더거나 필수 파라미터 누락)"
   */
  router.post(
    '/',
    validateParams(slugParams),
    validateBody(participantSchemas.registerRequest),
    optionalAuth,
    asyncHandler(controller.registerParticipant)
  );

  /**
   * @swagger
   * /api/v1/calendars/{slug}/participants/login:
   *   post:
   *     summary: 참가자 로그인
   *     description: "비회원은 닉네임과 비밀번호로 로그인하며, 회원은 본인 계정 정보로 자동 매칭됩니다."
   *     security:
   *       - UserAuth: []
   *       - {}
   *     tags: [participant]
   *     parameters:
   *       - in: path
   *         name: slug
   *         required: true
   *         description: "캘린더의 고유 식별 토큰"
   *         schema:
   *           type: string
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: "#/components/schemas/LoginParticipantRequest"
   *     responses:
   *       200:
   *         description: 로그인 성공
   *         content:
   *           application/json:
   *             schema:
   *               $ref: "#/components/schemas/LoginParticipantResponse"
   *       400:
   *         description: "닉네임/비밀번호 누락 또는 잘못된 정보"
   *       404:
   *         description: "존재하지 않는 캘린더"
   */
  router.post(
    PARTICIPANT_ROUTES.LOGIN,
    validateParams(slugParams),
    ...(env.ENABLE_RATE_LIMIT ? [authRateLimiter] : []),
    validateBody(participantSchemas.loginRequest),
    optionalAuth,
    asyncHandler(controller.loginParticipant)
  );

  /**
   * @swagger
   * /api/v1/calendars/{slug}/participants:
   *   get:
   *     summary: 캘린더의 모든 참가자 조회 (투표 현황 포함)
   *     description: "해당 캘린더에 참여 중인 모든 유저의 목록과 각자의 투표 통계를 반환합니다."
   *     tags: [participant]
   *     parameters:
   *       - in: path
   *         name: slug
   *         required: true
   *         description: "캘린더의 고유 식별 토큰"
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: 참가자 목록 조회 완료
   *         content:
   *           application/json:
   *             schema:
   *               $ref: "#/components/schemas/GetParticipantsResponse"
   *       404:
   *         description: "존재하지 않는 캘린더"
   */
  router.get('/', validateParams(slugParams), asyncHandler(controller.getParticipants));

  /**
   * @swagger
   * /api/v1/calendars/{slug}/participants/self:
   *   delete:
   *     summary: 참가자 삭제 (스스로)
   *     description: 본인만 가능, 토큰 필요
   *     security:
   *       - ParticipantAuth: []
   *     parameters:
   *       - in: path
   *         name: slug
   *         required: true
   *         description: "캘린더의 고유 식별 토큰 (예: Ab3dE9xR)"
   *         schema:
   *           type: string
   *     tags: [participant]
   *     responses:
   *       200:
   *         description: 참가자 삭제 완료
   *         content:
   *           application/json:
   *             schema:
   *               $ref: "#/components/schemas/DefaultResponseDto"
   *       500:
   *         description: 인증 중 오류
   *       403:
   *         description: 방장은 방장을 삭제 불가 => 캘린더 삭제
   */
  router.delete(
    PARTICIPANT_ROUTES.DELETE_SELF,
    validateParams(slugParams),
    authenticateParticipant,
    asyncHandler(controller.deleteParticipantSelf)
  );

  /**
   * @swagger
   * /api/v1/calendars/{slug}/participants/{participantUuid}:
   *   delete:
   *     summary: 방장의 유저 강퇴
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
   *       - in: path
   *         name: participantUuid
   *         required: true
   *         description: "강퇴할 유저의 participantUuid"
   *         schema:
   *           type: string
   *     tags: [participant]
   *     responses:
   *       200:
   *         description: 방장의 유저 강퇴 성공
   *         content:
   *           application/json:
   *             schema:
   *               $ref: "#/components/schemas/DefaultResponseDto"
   *       500:
   *         description: 인증 중 오류
   *       403:
   *         description: 권한 부족 방장만 가능
   */
  router.delete(
    PARTICIPANT_ROUTES.DELETE_BY_HOST,
    validateParams(commonSchemas.slugAndParticipantUuidParams),
    authenticateParticipant,
    asyncHandler(controller.deleteParticipantAsHost)
  );

  return router;
};
