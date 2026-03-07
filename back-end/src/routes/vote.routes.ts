import { Router } from 'express';

import { VOTE_ROUTES } from '../constants/routes.constants';
import { VoteController } from '../controllers/vote.controller';
import { authenticateParticipant } from '../middlewares/auth';
import { asyncHandler } from '../middlewares/errorHandler';
import {
  commonSchemas,
  slugParams,
  validateBody,
  validateParams,
  voteSchemas,
} from '../middlewares/validation';

export const createVoteRouter = (controller: VoteController): Router => {
  const router = Router({ mergeParams: true });

  /**
   * @swagger
   * /api/v1/calendars/{slug}/votes:
   *   post:
   *     summary: 투표 제출 및 수정
   *     tags: [Votes]
   *     description: 특정 캘린더의 날짜들에 대해 투표를 제출, 복수날짜 선택
   *     security:
   *       - ParticipantAuth: []
   *     parameters:
   *       - in: path
   *         name: slug
   *         required: true
   *         schema:
   *           type: string
   *         description: 캘린더 식별자 (slug)
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/SubmitVoteRequest'
   *     responses:
   *       200:
   *         description: 투표 성공
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/SubmitVoteResponse'
   *       400:
   *         description: 잘못된 요청 (마감된 캘린더, 기간 종료 등)
   *       401:
   *         description: 인증 실패
   *       403:
   *         description: 권한 없음 (해당 캘린더 참여자 아님)
   */
  router.post(
    '/',
    validateParams(slugParams),
    validateBody(voteSchemas.subVoteRequest),
    authenticateParticipant,
    asyncHandler(controller.submitVotes)
  );

  /**
   * @swagger
   * /api/v1/calendars/{slug}/votes:
   *   get:
   *     summary: 캘린더 전체 투표 현황 조회
   *     tags: [Votes]
   *     description: 캘린더 정보와 함께 날짜별 투표 상태를 조회
   *     parameters:
   *       - in: path
   *         name: slug
   *         required: true
   *         schema:
   *           type: string
   *         description: 캘린더 식별자 (slug)
   *     responses:
   *       200:
   *         description: 조회 성공
   *         content:
   *           application/json:
   *             schema:
   *               $ref: "#/components/schemas/GetVoteStatusResponse"
   *       404:
   *         description: 캘린더를 찾을 수 없음
   */
  router.get('/', validateParams(slugParams), asyncHandler(controller.getVoteStatus));

  /**
   * @swagger
   * /api/v1/calendars/{slug}/votes/{participantUuid}:
   *   get:
   *     summary: 특정 참가자의 투표 내역 조회
   *     tags: [Votes]
   *     description: 특정 참가자가 어떤 날짜에 투표했는지 상세 내역을 조회합니다.
   *     parameters:
   *       - in: path
   *         name: slug
   *         required: true
   *         schema:
   *           type: string
   *       - in: path
   *         name: participantUuid
   *         required: true
   *         schema:
   *           type: string
   *         description: 참가자 고유 UUID
   *     responses:
   *       200:
   *         description: 조회 성공
   *         content:
   *           application/json:
   *             schema:
   *               $ref: "#/components/schemas/GetParticipantVotesResponse"
   *       404:
   *         description: 참가자 또는 캘린더를 찾을 수 없음
   */
  router.get(
    VOTE_ROUTES.CHECK_VOTE,
    validateParams(commonSchemas.slugAndParticipantUuidParams),
    asyncHandler(controller.getParticipantVotes)
  );
  return router;
};
