import { NextFunction, Request, Response } from 'express';
import Joi from 'joi';

import { VALID_DATE_KINDS } from '../models/DateInfo';
import {
  compareDateOnly,
  daysBetweenDateOnly,
  normalizeCompactDateOnly,
  normalizeDateOnly,
  parseDateOnlyToUtcDate,
} from '../utils/dateOnly';
import { Errors } from '../utils/errors';

const validationOptions = {
  abortEarly: false,
  stripUnknown: true,
  allowUnknown: false,
};

function normalizeDateOnlyForJoi(value: string, helpers: Joi.CustomHelpers) {
  try {
    return normalizeDateOnly(value);
  } catch (err) {
    return helpers.message({
      custom: err instanceof Error ? err.message : '날짜 형식이 올바르지 않습니다',
    } as any);
  }
}

function normalizeCompactDateOnlyForJoi(value: string, helpers: Joi.CustomHelpers) {
  try {
    return normalizeCompactDateOnly(value);
  } catch (err) {
    return helpers.message({
      custom: err instanceof Error ? err.message : '날짜 형식이 올바르지 않습니다',
    } as any);
  }
}

export const validateBody = (schema: Joi.ObjectSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const { error, value } = schema.validate(req.body, validationOptions);

    if (error) {
      const message = error.details.map((detail) => detail.message).join(', ');
      return next(Errors.ValidationError(message, error.details));
    }

    req.body = value;
    // Normalize date strings to UTC date-only Date objects for dateInfo endpoints
    try {
      if (value && Array.isArray(value.dateInfos)) {
        value.dateInfos.forEach((item: any) => {
          if (item && typeof item.locationDate === 'string') {
            item.locationDate = parseDateOnlyToUtcDate(item.locationDate);
          }
        });
      }

      if (value && Array.isArray(value.dateNamePairs)) {
        value.dateNamePairs.forEach((item: any) => {
          if (item && typeof item.locationDate === 'string') {
            item.locationDate = parseDateOnlyToUtcDate(item.locationDate);
          }
        });
      }
    } catch (e) {
      return next(Errors.ValidationError('날짜 변환 중 오류가 발생했습니다', e));
    }

    next();
  };
};

export const validateQuery = (schema: Joi.ObjectSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const { error, value } = schema.validate(req.query, validationOptions);

    if (error) {
      const message = error.details.map((detail) => detail.message).join(', ');
      return next(Errors.ValidationError(message, error.details));
    }

    req.query = value;
    next();
  };
};

export const validateParams = (schema: Joi.ObjectSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const { error, value } = schema.validate(req.params, validationOptions);

    if (error) {
      const message = error.details.map((detail) => detail.message).join(', ');
      return next(Errors.ValidationError(message, error.details));
    }

    req.params = value;
    next();
  };
};

export const participantUuidParams = Joi.object({
  participantUuid: Joi.string()
    .trim()
    .uuid()
    .required()
    .messages({ 'any.required': '타켓 uuid가 필요합니다' }),
});

export const slugParams = Joi.object({
  slug: Joi.string().trim().required().messages({ 'any.required': 'slug가 필요합니다' }),
});

export const commonSchemas = {
  slugAndParticipantUuidParams: slugParams.concat(participantUuidParams),

  dateRange: Joi.object({
    start_date: Joi.string()
      .trim()
      .required()
      .custom(normalizeDateOnlyForJoi, 'Normalize date-only string'),
    end_date: Joi.string()
      .trim()
      .required()
      .custom(endDateVerifier)
      .custom(normalizeDateOnlyForJoi, 'Normalize date-only string'),
  }),
};

export const authSchemas = {
  callbackQuery: Joi.object({
    code: Joi.string()
      .trim()
      .required()
      .messages({ 'any.required': '인증 정보가 만료되었거나 올바르지 않은 접근입니다.' }),
    state: Joi.string()
      .trim()
      .required()
      .messages({ 'any.required': 'OAuth state가 누락되었습니다.' }),
  }),

  signupRequest: Joi.object({
    signupToken: Joi.string().trim().required(),
    isTermsAgreed: Joi.boolean().invalid(false).required().messages({
      'any.invalid': '이용약관에 동의해야 합니다',
      'any.required': '약관 동의 여부는 필수입니다',
    }),
  }),
};

export const calendarSchemas = {
  createRequest: Joi.object({
    title: Joi.string().trim().min(1).max(100).required(),
    description: Joi.string().trim().allow('', null).optional(),
    hostNickname: Joi.string().trim().min(1).max(20).required(),
  }).concat(commonSchemas.dateRange),

  updateRequest: Joi.object({
    title: Joi.string().trim().min(1).max(100).optional(),
    description: Joi.string().trim().allow('', null).optional(),
    start_date: Joi.string()
      .trim()
      .optional()
      .custom(normalizeDateOnlyForJoi, 'Normalize date-only string'),
    end_date: Joi.string()
      .trim()
      .optional()
      .custom(endDateVerifier)
      .custom(normalizeDateOnlyForJoi, 'Normalize date-only string'),
  }),
};

export const participantSchemas = {
  registerRequest: Joi.object({
    nickname: Joi.string()
      .trim()
      .min(1)
      .max(20)
      .required()
      .messages({ 'any.required': '닉네임은 필수입니다' }),
    password: Joi.string().trim().min(4).max(50).optional(),
  }),

  loginRequest: Joi.object({
    nickname: Joi.string().trim().optional(),
    password: Joi.string().trim().optional(),
  }),
};

export const voteSchemas = {
  subVoteRequest: Joi.object({
    selectedDates: Joi.array()
      .items(
        Joi.string()
          .trim()
          .required()
          .custom(normalizeDateOnlyForJoi, 'Normalize date-only string')
      )
      .min(1)
      .unique()
      .required()
      .messages({
        'any.required': '날짜를 선택해주세요',
        'array.min': '날짜를 최소 1개 이상 선택해주세요',
      }),
    voteType: Joi.string().trim().valid('available', 'unavailable', 'maybe').required().messages({
      'any.required': '투표 타입은 필수입니다',
      'any.only': '유효하지 않은 투표 타입입니다 (available | unavailable | maybe)',
    }),
  }),
};

// 공통 필드 조각
const yearField = Joi.string()
  .trim()
  .pattern(/^\d{4}$/)
  .messages({ 'string.pattern.base': 'year는 4자리 연도여야 합니다' });

const locationDateField = Joi.string()
  .trim()
  .custom(normalizeCompactDateOnlyForJoi, 'Normalize compact date-only string');

const dateKindField = Joi.string()
  .valid(...VALID_DATE_KINDS)
  .messages({ 'any.only': `유효하지 않은 dateKind입니다` });

// 공통 배열 조각
const yearsArrayField = Joi.array().items(yearField);
const dateKindsArrayField = Joi.array().items(dateKindField);

// 단건 아이템
const dateInfoItemSchema = Joi.object({
  locationDate: locationDateField
    .required()
    .messages({ 'any.required': 'locationDate는 필수입니다' }),
  year: yearField.required().messages({ 'any.required': 'year는 필수입니다' }),
  seq: Joi.number().integer().min(1).required().messages({ 'any.required': 'seq는 필수입니다' }),
  dateName: Joi.string()
    .trim()
    .min(1)
    .required()
    .messages({ 'any.required': 'dateName은 필수입니다' }),
  dateKind: dateKindField.required().messages({ 'any.required': 'dateKind는 필수입니다' }),
  isHoliday: Joi.boolean().required().messages({ 'any.required': 'isHoliday는 필수입니다' }),
  dataSource: Joi.string().valid('custom').required().messages({
    'any.required': 'dataSource는 필수입니다',
    'any.only': 'dataSource는 custom만 허용됩니다',
  }),
});

const dateNamePairSchema = Joi.object({
  locationDate: locationDateField
    .required()
    .messages({ 'any.required': 'locationDate는 필수입니다' }),
  dateName: Joi.string()
    .trim()
    .min(1)
    .required()
    .messages({ 'any.required': 'dateName은 필수입니다' }),
});

export const dateInfoSchemas = {
  // POST /date-infos
  createRequest: dateInfoItemSchema,

  // POST /date-infos/batch
  createBatchRequest: Joi.object({
    dateInfos: Joi.array().items(dateInfoItemSchema).min(1).required().messages({
      'any.required': 'dateInfos는 필수입니다',
      'array.min': 'dateInfos는 최소 1개 이상이어야 합니다',
    }),
  }),

  // GET|DELETE /date-infos/before?year=2025
  yearQuery: Joi.object({
    year: yearField.required().messages({ 'any.required': 'year는 필수입니다' }),
  }),

  yearsQuery: Joi.object({
    years: yearsArrayField.min(1).required().messages({
      'any.required': 'years는 필수입니다',
      'array.min': 'years는 최소 1개 이상이어야 합니다',
    }),
  }),

  // params /:year
  yearParams: Joi.object({
    year: yearField.required().messages({ 'any.required': 'year는 필수입니다' }),
  }),

  // GET /date-infos/:year/kinds?dateKinds[]=01
  yearKindsQuery: Joi.object({
    dateKinds: dateKindsArrayField.min(1).required().messages({
      'any.required': 'dateKinds는 필수입니다',
      'array.min': 'dateKinds는 최소 1개 이상이어야 합니다',
    }),
  }),

  // GET /date-infos/kinds?years[]=2023&dateKinds[]=01
  yearsAndKindsQuery: Joi.object({
    years: yearsArrayField.min(1).required().messages({
      'any.required': 'years는 필수입니다',
      'array.min': 'years는 최소 1개 이상이어야 합니다',
    }),
    dateKinds: dateKindsArrayField.min(1).required().messages({
      'any.required': 'dateKinds는 필수입니다',
      'array.min': 'dateKinds는 최소 1개 이상이어야 합니다',
    }),
  }),

  deleteByDatesAndNamesRequest: Joi.object({
    dateNamePairs: Joi.array().items(dateNamePairSchema).min(1).required().messages({
      'any.required': 'dateNamePairs는 필수입니다',
      'array.min': 'dateNamePairs는 최소 1개 이상이어야 합니다',
    }),
  }),
};

function endDateVerifier(value: string, helpers: Joi.CustomHelpers) {
  const startDate = helpers.state.ancestors[0].start_date;
  if (!startDate) return value;

  let normalizedStart: string;
  let normalizedEnd: string;

  try {
    normalizedStart = normalizeDateOnly(startDate);
    normalizedEnd = normalizeDateOnly(value);
  } catch (err) {
    return helpers.message({
      custom: err instanceof Error ? err.message : '날짜 형식이 올바르지 않습니다',
    } as any);
  }

  if (compareDateOnly(normalizedStart, normalizedEnd) > 0) {
    return helpers.message({ custom: '종료일은 시작일보다 이전일 수 없습니다' } as any);
  }

  const diffDays = daysBetweenDateOnly(normalizedStart, normalizedEnd);
  if (diffDays > 365) {
    return helpers.message({ custom: '투표 기간은 최대 1년까지 가능합니다' } as any);
  }

  return value;
}
