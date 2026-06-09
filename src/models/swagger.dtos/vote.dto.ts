import { CalendarForVoteStatus } from './calendar.dto';
import { DefaultResponseDto } from './common.dto';
import { CommonParticipant } from './participant.dto';

/**
 * @swagger
 * components:
 *   schemas:
 *     VoteTypeForDto:
 *       type: string
 *       enum: [available, unavailable, maybe]
 *       description: "투표 상태 (available: 가능, unavailable: 불가능, maybe: 미정)"
 *       example: "available"
 */
export type VoteTypeForDto = 'available' | 'unavailable' | 'maybe';

/**
 * @swagger
 * components:
 *   schemas:
 *     VoteRecord:
 *       type: object
 *       properties:
 *         vote_id:
 *           type: integer
 *           example: 1
 *         date_value:
 *           type: string
 *           format: date
 *           example: "2026-02-15"
 *         vote_type:
 *           $ref: "#/components/schemas/VoteTypeForDto"
 *         created_at:
 *           type: string
 *           format: date-time
 *           example: "2026-02-19T12:00:00Z"
 */
export interface VoteRecord {
  vote_id: number;
  date_value: string;
  vote_type: VoteTypeForDto;
  created_at: Date;
}

/**
 * @swagger
 * components:
 *   schemas:
 *     SubmitVoteRequest:
 *       type: object
 *       required:
 *         - selectedDates
 *         - voteType
 *       properties:
 *         selectedDates:
 *           type: array
 *           items:
 *             type: string
 *             format: date
 *           example: "2026-02-15"
 *           description: "투표할 날짜 리스트 (YYYY-MM-DD)"
 *         voteType:
 *           $ref: "#/components/schemas/VoteTypeForDto"
 */
export interface SubmitVoteRequest {
  selectedDates: string[];
  voteType: VoteTypeForDto;
}

/**
 * @swagger
 * components:
 *   schemas:
 *     SubmitVoteResponse:
 *       allOf:
 *         - $ref: "#/components/schemas/DefaultResponseDto"
 *         - type: object
 *           properties:
 *             selectedDates:
 *               type: array
 *               items:
 *                 type: string
 *               example: ["2026-02-15", "2026-02-16"]
 *             votedCount:
 *               type: integer
 *               example: 2
 */
export interface SubmitVoteResponse extends DefaultResponseDto {
  selectedDates: string[];
  votedCount: number;
}

/**
 * @swagger
 * components:
 *   schemas:
 *     DateVoteStatusDto:
 *       type: object
 *       properties:
 *         date_option_id:
 *           type: integer
 *           example: 10
 *         date_value:
 *           type: string
 *           format: date
 *           example: "2026-02-15"
 *         is_enabled:
 *           type: boolean
 *           example: true
 *         votes:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               participant_id:
 *                 type: integer
 *               participant_nickname:
 *                 type: string
 *               participant_color:
 *                 type: string
 *               vote_type:
 *                 $ref: "#/components/schemas/VoteTypeForDto"
 */
interface DateVoteStatusDto {
  date_option_id: number;
  date_value: string;
  is_enabled: boolean;
  votes: {
    participant_id: number;
    participant_nickname: string;
    participant_color: string;
    vote_type: VoteTypeForDto;
  }[];
}

/**
 * @swagger
 * components:
 *   schemas:
 *     GetVoteStatusResponse:
 *       type: object
 *       properties:
 *         calendar:
 *           $ref: "#/components/schemas/CalendarForVoteStatus"
 *         voteStatus:
 *           type: array
 *           items:
 *             $ref: "#/components/schemas/DateVoteStatusDto"
 */
export interface GetVoteStatusResponse {
  calendar: CalendarForVoteStatus;
  voteStatus: DateVoteStatusDto[];
}

/**
 * @swagger
 * components:
 *   schemas:
 *     GetParticipantVotesResponse:
 *       type: object
 *       properties:
 *         participant:
 *           type: object
 *           properties:
 *             uuid:
 *               type: string
 *             nickname:
 *               type: string
 *             color_code:
 *               type: string
 *         votes:
 *           type: array
 *           items:
 *             $ref: "#/components/schemas/VoteRecord"
 *         voteCount:
 *           type: integer
 *           example: 5
 */
export interface GetParticipantVotesResponse {
  participant: Omit<CommonParticipant, 'joined_at'>;
  votes: VoteRecord[];
  voteCount: number;
}
