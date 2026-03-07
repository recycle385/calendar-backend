export interface AppErrorOptions<T = unknown> {
  errorCode?: string;
  details?: T;
  isOperational?: boolean; // 기본 true
}

export class AppError<T = unknown> extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly errorCode?: string;
  public readonly details?: T;

  constructor(message: string, statusCode = 500, options: AppErrorOptions<T> = {}) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = options.isOperational ?? true;
    this.errorCode = options.errorCode;
    this.details = options.details;

    Error.captureStackTrace(this, this.constructor);
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
