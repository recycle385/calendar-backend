/**
 * @swagger
 * components:
 *   schemas:
 *     DefaultResponseDto:
 *       type: object
 *       properties:
 *         message:
 *           type: string
 *           example: "성공적으로 처리되었습니다."
 */
export interface DefaultResponseDto {
  message: string;
}
