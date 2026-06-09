import axios from 'axios';

import { AppError } from './AppError';
import { ErrorCode, HttpStatus } from './enums';

export const Errors = {
  BadRequest: (message = '잘못된 요청입니다.', details?: any) =>
    new AppError(message, HttpStatus.BAD_REQUEST, {
      errorCode: ErrorCode.INVALID_INPUT,
      details,
    }),

  NotFound: (message = '요청하신 리소스를 찾을 수 없습니다.', errorCode?: string, details?: any) =>
    new AppError(message, HttpStatus.NOT_FOUND, {
      errorCode: errorCode ?? ErrorCode.USER_NOT_FOUND,
      details,
    }),

  Unauthorized: (message = '인증이 필요합니다.') =>
    new AppError(message, HttpStatus.UNAUTHORIZED, {
      errorCode: ErrorCode.AUTH_REQUIRED,
    }),

  Internal: (message = '서버 내부 오류가 발생했습니다.', details?: any) =>
    new AppError(message, HttpStatus.INTERNAL, {
      isOperational: false,
      details,
    }),

  ValidationError: (message = '입력값 검증에 실패했습니다.', details?: any) =>
    new AppError(message, HttpStatus.BAD_REQUEST, {
      errorCode: ErrorCode.VALIDATION_ERROR,
      details,
    }),

  Forbidden: (message = '접근 권한이 없습니다.') =>
    new AppError(message, HttpStatus.FORBIDDEN, {
      errorCode: ErrorCode.FORBIDDEN,
    }),

  Conflict: (message = '이미 존재하는 리소스입니다.', details?: any) =>
    new AppError(message, HttpStatus.CONFLICT, {
      errorCode: ErrorCode.INVALID_INPUT,
      details,
    }),

  ExternalApiError: (err: unknown, defaultMessage: string) => {
    if (axios.isAxiosError(err)) {
      return new AppError(
        err.response?.data?.error_description || err.response?.data?.message || defaultMessage,
        err.response?.status || HttpStatus.INTERNAL,
        {
          errorCode: ErrorCode.EXTERNAL_API_ERROR,
          details: err.response?.data,
        }
      );
    }

    return new AppError(err instanceof Error ? err.message : defaultMessage, HttpStatus.INTERNAL, {
      errorCode: ErrorCode.EXTERNAL_API_ERROR,
    });
  },

  BadGateway: (apiType: string, message = `${apiType} API 응답이 올바르지 않습니다.`) =>
    new AppError(message, 502, { errorCode: ErrorCode.EXTERNAL_API_ERROR }),
};

export { AppError } from './AppError';
