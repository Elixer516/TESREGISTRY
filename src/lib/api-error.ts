import type { CsvRowError, ScheduleConflictDetail } from '@/types';

export type ApiErrorCode =
  | 'BAD_REQUEST'
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'VALIDATION_FAILED'
  | 'SCHEDULE_CONFLICT'
  | 'ACCOUNT_PENDING'
  | 'ACCOUNT_SUSPENDED'
  | 'ACCOUNT_DEACTIVATED'
  | 'ACCOUNT_REJECTED'
  | 'ACCOUNT_LOCKED'
  | 'INVALID_CREDENTIALS'
  | 'PASSWORD_REQUIRED'
  | 'TERM_INACTIVE'
  | 'DUPLICATE'
  | 'GENERATION_REFUSED';

export interface ApiErrorOptions {
  conflicts?: ScheduleConflictDetail[];
  details?: string[];
  rowErrors?: CsvRowError[];
}

/**
 * The single error type crossing the client/server seam. It mirrors what an
 * HTTP client would surface: a status, a machine-readable code, a message and
 * optional structured payloads.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly code: ApiErrorCode;
  readonly conflicts?: ScheduleConflictDetail[];
  readonly details?: string[];
  readonly rowErrors?: CsvRowError[];

  constructor(
    status: number,
    code: ApiErrorCode,
    message: string,
    options: ApiErrorOptions = {},
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    if (options.conflicts) this.conflicts = options.conflicts;
    if (options.details) this.details = options.details;
    if (options.rowErrors) this.rowErrors = options.rowErrors;
  }
}

export function isApiError(value: unknown): value is ApiError {
  return value instanceof ApiError;
}

/** Best-effort message extraction for `catch (err: unknown)` blocks. */
export function errorMessage(value: unknown, fallback = 'Something went wrong.'): string {
  if (isApiError(value)) return value.message;
  if (value instanceof Error && value.message) return value.message;
  return fallback;
}

export const badRequest = (message: string, options?: ApiErrorOptions): ApiError =>
  new ApiError(400, 'BAD_REQUEST', message, options);

export const validationFailed = (message: string, options?: ApiErrorOptions): ApiError =>
  new ApiError(422, 'VALIDATION_FAILED', message, options);

export const forbidden = (message: string): ApiError =>
  new ApiError(403, 'FORBIDDEN', message);

export const notFound = (message: string): ApiError =>
  new ApiError(404, 'NOT_FOUND', message);

export const conflict = (message: string, options?: ApiErrorOptions): ApiError =>
  new ApiError(409, 'CONFLICT', message, options);

export const duplicate = (message: string): ApiError =>
  new ApiError(409, 'DUPLICATE', message);
