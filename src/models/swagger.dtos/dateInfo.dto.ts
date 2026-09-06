/**
 * @swagger
 * components:
 *   schemas:
 *     DateKind:
 *       type: string
 *       enum: ["01", "02", "03", "04", "05"]
 *       description: "01: 휴일, 02: 국경일, 03: 기념일, 04: 24절기, 05: 잡절"
 *       example: "03"
 *     DateInfoSource:
 *       type: string
 *       enum: [public-api, custom]
 *       example: "custom"
 *     SafeDateInfoDto:
 *       type: object
 *       required:
 *         - locationDate
 *         - year
 *         - seq
 *         - dateName
 *         - dateKind
 *         - isHoliday
 *         - dataSource
 *         - updatedAt
 *       properties:
 *         locationDate:
 *           type: string
 *           pattern: "^\\d{8}$"
 *           description: "YYYYMMDD 형식"
 *           example: "20260505"
 *         year:
 *           type: string
 *           pattern: "^\\d{4}$"
 *           example: "2026"
 *         seq:
 *           type: integer
 *           minimum: 1
 *           example: 1
 *         dateName:
 *           type: string
 *           example: "어린이날"
 *         dateKind:
 *           $ref: "#/components/schemas/DateKind"
 *         isHoliday:
 *           type: boolean
 *           example: true
 *         dataSource:
 *           $ref: "#/components/schemas/DateInfoSource"
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           example: "2026-07-11T15:44:54.000Z"
 *     AddDateInfoRequest:
 *       type: object
 *       required:
 *         - locationDate
 *         - year
 *         - seq
 *         - dateName
 *         - dateKind
 *         - isHoliday
 *         - dataSource
 *       properties:
 *         locationDate:
 *           type: string
 *           pattern: "^\\d{8}$"
 *           description: "YYYYMMDD 형식"
 *           example: "20260505"
 *         year:
 *           type: string
 *           pattern: "^\\d{4}$"
 *           example: "2026"
 *         seq:
 *           type: integer
 *           minimum: 1
 *           example: 1
 *         dateName:
 *           type: string
 *           minLength: 1
 *           example: "어린이날"
 *         dateKind:
 *           $ref: "#/components/schemas/DateKind"
 *         isHoliday:
 *           type: boolean
 *           example: true
 *         dataSource:
 *           type: string
 *           enum: [custom]
 *           example: "custom"
 *     AddDateInfosRequest:
 *       type: object
 *       required:
 *         - dateInfos
 *       properties:
 *         dateInfos:
 *           type: array
 *           minItems: 1
 *           items:
 *             $ref: "#/components/schemas/AddDateInfoRequest"
 *     DateInfoMapByYear:
 *       type: object
 *       additionalProperties:
 *         type: array
 *         items:
 *           $ref: "#/components/schemas/SafeDateInfoDto"
 *       example:
 *         "2026":
 *           - locationDate: "20260505"
 *             year: "2026"
 *             seq: 1
 *             dateName: "어린이날"
 *             dateKind: "03"
 *             isHoliday: false
 *             dataSource: "public-api"
 *             updatedAt: "2026-07-11T15:44:54.000Z"
 *     DeleteDateInfoPairsRequest:
 *       type: object
 *       required:
 *         - dateNamePairs
 *       properties:
 *         dateNamePairs:
 *           type: array
 *           minItems: 1
 *           items:
 *             type: object
 *             required:
 *               - locationDate
 *               - dateName
 *             properties:
 *               locationDate:
 *                 type: string
 *                 pattern: "^\\d{8}$"
 *                 description: "YYYYMMDD 형식"
 *                 example: "20260505"
 *               dateName:
 *                 type: string
 *                 minLength: 1
 *                 example: "어린이날"
 */

export interface SafeDateInfoDto {
  locationDate: string;
  year: string;
  seq: number;
  dateName: string;
  dateKind: '01' | '02' | '03' | '04' | '05';
  isHoliday: boolean;
  dataSource: 'public-api' | 'custom';
  updatedAt: Date;
}

export interface AddDateInfoRequest {
  locationDate: string;
  year: string;
  seq: number;
  dateName: string;
  dateKind: '01' | '02' | '03' | '04' | '05';
  isHoliday: boolean;
  dataSource: 'custom';
}

export interface AddDateInfosRequest {
  dateInfos: AddDateInfoRequest[];
}

export interface DateInfoMapByYearDto {
  [year: string]: SafeDateInfoDto[];
}

export interface DeleteDateInfoPairsRequest {
  dateNamePairs: {
    locationDate: string;
    dateName: string;
  }[];
}
