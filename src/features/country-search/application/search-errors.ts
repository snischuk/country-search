import { SEARCH_ERROR_TYPES } from '../domain/search-state.type';
import type { SearchErrorType } from '../domain/search-state.type';

const ERROR_NAMES = {
  abort: 'AbortError',
  timeout: 'TimeoutError',
} as const;

const SEARCH_ERROR_MESSAGES = {
  timeout: 'The search took too long. Please try again.',
  network: 'The country service could not be reached. Please try again.',
  invalidResponse:
    'The country service returned invalid data. Please try again.',
} as const;

export interface ClassifiedSearchError {
  readonly errorType: SearchErrorType;
  readonly message: string;
  readonly statusCode: number | null;
}

export function getSearchError(error: unknown): ClassifiedSearchError | null {
  const errorName: unknown =
    isObject(error) && 'name' in error ? error.name : null;

  if (errorName === ERROR_NAMES.abort) {
    return null;
  }

  if (errorName === ERROR_NAMES.timeout) {
    return {
      errorType: SEARCH_ERROR_TYPES.timeout,
      message: SEARCH_ERROR_MESSAGES.timeout,
      statusCode: null,
    };
  }

  if (error instanceof HttpError) {
    return {
      errorType: SEARCH_ERROR_TYPES.http,
      message: error.message,
      statusCode: error.statusCode,
    };
  }

  if (error instanceof ValidationError) {
    return {
      errorType: SEARCH_ERROR_TYPES.invalidResponse,
      message: SEARCH_ERROR_MESSAGES.invalidResponse,
      statusCode: null,
    };
  }

  return {
    errorType: SEARCH_ERROR_TYPES.network,
    message: SEARCH_ERROR_MESSAGES.network,
    statusCode: null,
  };
}

function isObject(value: unknown): value is object {
  return typeof value === 'object' && value !== null;
}

export class HttpError extends Error {
  public readonly statusCode: number;

  public constructor(statusCode: number) {
    super(`The country service returned HTTP ${statusCode}.`);
    this.name = HttpError.name;
    this.statusCode = statusCode;
  }
}

export class ValidationError extends Error {
  public constructor(
    message: string = 'The country service returned an invalid response.',
  ) {
    super(message);
    this.name = ValidationError.name;
  }
}
