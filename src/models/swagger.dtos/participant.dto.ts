import { DefaultResponseDto } from './common.dto';

/**
 * @swagger
 * components:
 *   schemas:
 *     RegisterParticipantRequest:
 *       type: object
 *       required:
 *         - nickname
 *       properties:
 *         nickname:
 *           type: string
 *           example: "민수"
 *         password:
 *           type: string
 *           example: "1234"
 */
export interface RegisterParticipantRequest {
  nickname: string;
  password?: string;
}

/**
 * @swagger
 * components:
 *   schemas:
 *     LoginParticipantRequest:
 *       type: object
 *       properties:
 *         nickname:
 *           type: string
 *           example: "민수"
 *         password:
 *           type: string
 *           example: "1234"
 */
export interface LoginParticipantRequest {
  nickname?: string;
  password?: string;
}

/**
 * @swagger
 * components:
 *   schemas:
 *     CommonParticipant:
 *       type: object
 *       properties:
 *         uuid:
 *           type: string
 *           example: "a1b2c3d4"
 *         nickname:
 *           type: string
 *           example: "민수"
 *         color_code:
 *           type: string
 *           example: "#FF0000"
 *         joined_at:
 *           type: string
 *           format: date-time
 */
export interface CommonParticipant {
  uuid: string;
  nickname: string;
  color_code: string;
  joined_at: Date;
}

/**
 * @swagger
 * components:
 *   schemas:
 *     DefaultParticipantDoc:
 *       allOf:
 *         - $ref: "#/components/schemas/CommonParticipant"
 *         - type: object
 *           properties:
 *             vote_count:
 *               type: number
 *             total_dates:
 *               type: number
 *             vote_rate:
 *               type: number
 */
export interface DefaultParticipantDoc extends CommonParticipant {
  vote_count: number;
  total_dates: number;
  vote_rate: number;
}

/**
 * @swagger
 * components:
 *   schemas:
 *     ParticipantForRegister:
 *       allOf:
 *         - $ref: '#/components/schemas/CommonParticipant'
 *         - type: object
 *           properties:
 *             role:
 *               type: string
 *               enum: [host, guest]
 *               example: "host"
 */
export interface ParticipantForRegister extends CommonParticipant {
  role: 'host' | 'guest';
}

/**
 * @swagger
 * components:
 *   schemas:
 *     RegisterParticipantResponse:
 *       allOf:
 *         - $ref: "#/components/schemas/DefaultResponseDto"
 *         - type: object
 *           properties:
 *             message:
 *               type: string
 *               example: "참가자 등록이 완료되었습니다"
 *             participant:
 *               $ref: "#/components/schemas/ParticipantForRegister"
 *             participantToken:
 *               type: string
 */
export interface RegisterParticipantResponse extends DefaultResponseDto {
  participant: ParticipantForRegister;
  participantToken: string;
}

/**
 * @swagger
 * components:
 *   schemas:
 *     LoginParticipantResponse:
 *       allOf:
 *         - $ref: "#/components/schemas/DefaultResponseDto"
 *         - type: object
 *           properties:
 *             message:
 *               type: string
 *               example: "로그인 성공"
 *             participant:
 *               $ref: "#/components/schemas/CommonParticipant"
 *             participantToken:
 *               type: string
 */
export interface LoginParticipantResponse extends DefaultResponseDto {
  participant: CommonParticipant;
  participantToken: string;
}

/**
 * @swagger
 * components:
 *   schemas:
 *     GetParticipantsResponse:
 *       type: object
 *       properties:
 *         participants:
 *           type: array
 *           items:
 *             $ref: "#/components/schemas/DefaultParticipantDoc"
 *         count:
 *           type: integer
 */
export interface GetParticipantsResponse {
  participants: DefaultParticipantDoc[];
  count: number;
}
