import { describe, expect, it } from 'vitest';

import {
  HttpError,
  ValidationError,
  getSearchError,
} from '@/features/country-search/application/search-errors';
import type { ClassifiedSearchError } from '@/features/country-search/application/search-errors';
import { SEARCH_ERROR_TYPES } from '@/features/country-search/domain/search-state.type';
import type { SearchErrorType } from '@/features/country-search/domain/search-state.type';

describe('search error classification', (): void => {
  it.each([
    new DOMException('Cancelled', 'AbortError'),
    { name: 'AbortError' },
  ])('keeps cancellation silent: %s', (error: unknown): void => {
    expect(getSearchError(error)).toBeNull();
  });

  it.each([
    {
      error: new DOMException('Deadline exceeded', 'TimeoutError'),
      errorType: SEARCH_ERROR_TYPES.timeout,
      statusCode: null,
    },
    {
      error: { name: 'TimeoutError' },
      errorType: SEARCH_ERROR_TYPES.timeout,
      statusCode: null,
    },
    {
      error: new HttpError(503),
      errorType: SEARCH_ERROR_TYPES.http,
      statusCode: 503,
    },
    {
      error: new ValidationError(),
      errorType: SEARCH_ERROR_TYPES.invalidResponse,
      statusCode: null,
    },
    {
      error: new TypeError('Failed to fetch'),
      errorType: SEARCH_ERROR_TYPES.network,
      statusCode: null,
    },
  ])(
    'classifies $errorType with a usable message',
    ({
      error,
      errorType,
      statusCode,
    }: {
      error: unknown;
      errorType: SearchErrorType;
      statusCode: number | null;
    }): void => {
      const classified: ClassifiedSearchError | null = getSearchError(error);

      expect(classified).toMatchObject({ errorType, statusCode });
      expect(classified?.message.trim()).toBeTruthy();
    },
  );

  it('offers recovery for a service failure without exposing technical terminology', (): void => {
    expect(getSearchError(new HttpError(503))).toMatchObject({
      message:
        'The country service is temporarily unavailable. Please try again in a moment.',
      statusCode: 503,
    });
  });

  it.each([null, undefined, 'failure', 0, {}, { name: 0 }])(
    'handles unexpected thrown input %j',
    (error: unknown): void => {
      expect(getSearchError(error)).toMatchObject({
        errorType: SEARCH_ERROR_TYPES.network,
        statusCode: null,
      });
    },
  );
});
