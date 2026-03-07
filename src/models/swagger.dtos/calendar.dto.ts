import { DefaultResponseDto } from './common.dto';

/**
 * @swagger
 * components:
 *   schemas:
 *     SafeCalendarDto:
 *       type: object
 *       required:
 *         [
 *           slug,
 *           title,
 *           start_date,
 *           end_date,
 *           is_closed,
 *           hostParticipantUuid,
 *           created_at,
 *           expired_at,
 *         ]
 *       properties:
 *         slug:
 *           type: string
 *           example: "Ab3dE9xR"
 *         title:
 *           type: string
 *           example: "스터디 모임"
 *         description:
 *           type: string
 *           nullable: true
 *           example: null
 *         start_date:
 *           type: string
 *           format: date-time
 *         end_date:
 *           type: string
 *           format: date-time
 *         is_closed:
 *           type: boolean
 *           example: false
 *         hostParticipantUuid:
 *           type: string
 *         created_at:
 *           type: string
 *           format: date-time
 *           example: "2026-02-01T12:00:00Z"
 *         expired_at:
 *           type: string
 *           format: date-time
 *           example: "2026-03-01T12:00:00Z"
 */
export interface SafeCalendarDto {
  slug: string; // 랜덤 토큰 (Ab3dE9xR)
  title: string;
  description: string | null;
  start_date: Date; // 투표 가능 시작일
  end_date: Date; // 투표 가능 종료일
  is_closed: boolean; // 투표 마감 여부
  hostParticipantUuid: string; // useruuid가 아니라 participantuuid 넣어야함 (safe 응답용)
  created_at: Date;
  expired_at: Date;
}

/**
 * @swagger
 * components:
 *   schemas:
 *     CreateCalendarRequest:
 *       type: object
 *       required: [title, start_date, end_date, hostNickname]
 *       properties:
 *         title:
 *           type: string
 *           example: "팀 프로젝트 회의"
 *         start_date:
 *           type: string
 *           format: date
 *           example: "2026-02-15"
 *         end_date:
 *           type: string
 *           format: date
 *           example: "2026-02-28"
 *         description:
 *           type: string
 *           example: "팀 프로젝트 회의 입니다."
 *           nullable: true
 *         hostNickname:
 *           type: string
 *           example: "방장"
 */
export interface CreateCalendarRequest {
  title: string;
  start_date: string; //YYYY-MM-DD
  end_date: string; //YYYY-MM-DD
  description?: string;
  hostNickname: string;
}

/**
 * @swagger
 * components:
 *   schemas:
 *     UpdateCalendarRequest:
 *       type: object
 *       properties:
 *         title:
 *           type: string
 *           example: "팀 프로젝트 회의"
 *         description:
 *           type: string
 *           example: "팀 프로젝트 회의 입니다."
 *           nullable: true
 *         start_date:
 *           type: string
 *           format: date
 *           example: "2026-02-15"
 *         end_date:
 *           type: string
 *           format: date
 *           example: "2026-02-28"
 */
export interface UpdateCalendarRequest {
  title?: string;
  description?: string;
  start_date?: string;
  end_date?: string;
}

/**
 * @swagger
 * components:
 *   schemas:
 *     CreateCalendarResponse:
 *       allOf:
 *         - $ref: "#/components/schemas/DefaultResponseDto"
 *         - type: object
 *           properties:
 *             message:
 *               type: string
 *             calendar:
 *               $ref: "#/components/schemas/SafeCalendarDto"
 *             shareUrl:
 *               type: string
 *             participantToken:
 *               type: string
 *               description: 특정 캘린더에서 회원/비회원 구분 없이 참여자를 식별하고 권한을 제어하는 JWT 토큰
 */
export interface CreateCalendarResponse extends DefaultResponseDto {
  calendar: SafeCalendarDto;
  shareUrl: string;
  participantToken: string;
}

/**
 * @swagger
 * components:
 *   schemas:
 *     GetMyCalendarsResponse:
 *       type: object
 *       properties:
 *         calendars:
 *           type: array
 *           items:
 *             $ref: "#/components/schemas/SafeCalendarDto"
 *         count:
 *           type: integer
 */
export interface GetMyCalendarsResponse {
  calendars: SafeCalendarDto[];
  count: number;
}

/**
 * @swagger
 * components:
 *   schemas:
 *     CommonCalendarResponse:
 *       allOf:
 *         - $ref: "#/components/schemas/DefaultResponseDto"
 *         - type: object
 *           properties:
 *             calendar:
 *               $ref: "#/components/schemas/SafeCalendarDto"
 */
export interface CommonCalendarResponse extends DefaultResponseDto {
  calendar: SafeCalendarDto;
}

/**
 * @swagger
 * components:
 *   schemas:
 *     CalendarForVoteStatus:
 *       type: object
 *       properties:
 *         slug:
 *           type: string
 *           example: "Ab3dE9xR"
 *         title:
 *           type: string
 *           example: "ㅇㄹ"
 *         start_date:
 *           type: string
 *           format: date-time
 *         end_date:
 *           type: string
 *           format: date-time
 *         is_closed:
 *           type: boolean
 *           example: false
 */
export interface CalendarForVoteStatus {
  slug: string;
  title: string;
  start_date: string;
  end_date: string;
  is_closed: boolean;
}
