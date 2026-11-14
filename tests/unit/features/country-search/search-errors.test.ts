import { describe, expect, it } from 'vitest';

import {
  HttpError,
  ValidationError,
  getSearchError,
} from '@/features/country-search/application/search-errors';
import type { ClassifiedSearchError } from '@/features/country-search/application/search-errors';
import { SEARCH_ERROR_TYPES } from '@/features/country-search/domain/search-state.type';
import type { SearchErrorType } from '@/features/country-search/domain/search-state.type';

function checkErrorDetails(
  error: unknown,
  errorType: SearchErrorType,
  statusCode: number | null = null,
): void {
  const classifiedError: ClassifiedSearchError | null = getSearchError(error);

  expect(classifiedError).toMatchObject({ errorType, statusCode });
  expect(classifiedError?.message).toBeTypeOf('string');
  expect(classifiedError?.message.trim()).toBeTruthy();
}

describe('getSearchError', (): void => {
  it('keeps intentional cancellation silent', (): void => {
    const abortError: Error = new Error('The request was cancelled.');

    abortError.name = 'AbortError';

    expect(getSearchError(abortError)).toBeNull();
  });

  it('recognizes cancellation by name at an unknown boundary', (): void => {
    const abortError: unknown = { name: 'AbortError' };

    expect(getSearchError(abortError)).toBeNull();
  });

  it('classifies a deadline failure as a recoverable timeout', (): void => {
    const timeoutError: Error = new Error('The operation timed out.');

    timeoutError.name = 'TimeoutError';

    checkErrorDetails(timeoutError, SEARCH_ERROR_TYPES.timeout);
  });

  it('recognizes timeout names without requiring a platform error class', (): void => {
    const timeoutError: unknown = { name: 'TimeoutError' };

    checkErrorDetails(timeoutError, SEARCH_ERROR_TYPES.timeout);
  });

  it('retains the HTTP status code for a service failure', (): void => {
    const serviceError: HttpError = new HttpError(503);

    checkErrorDetails(serviceError, SEARCH_ERROR_TYPES.http, 503);
  });

  it('explains service failures without exposing HTTP terminology', (): void => {
    const classifiedError: ClassifiedSearchError | null = getSearchError(
      new HttpError(503),
    );

    expect(classifiedError?.message).toBe(
      'The country service is temporarily unavailable. Please try again in a moment.',
    );

    expect(classifiedError?.statusCode).toBe(503);
  });

  it('classifies invalid response data separately from network failures', (): void => {
    checkErrorDetails(
      new ValidationError(),
      SEARCH_ERROR_TYPES.invalidResponse,
    );
  });

  it('classifies a failed fetch as a recoverable network error', (): void => {
    checkErrorDetails(
      new TypeError('Failed to fetch'),
      SEARCH_ERROR_TYPES.network,
    );
  });

  it.each([null, undefined, 'failure', 0, {}, { name: 0 }])(
    'handles an unexpected thrown value safely: %j',
    (thrownValue: unknown): void => {
      checkErrorDetails(thrownValue, SEARCH_ERROR_TYPES.network);
    },
  );
});
