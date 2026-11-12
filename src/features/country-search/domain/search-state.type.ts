import type { Country } from './country.type';

export const SEARCH_STATUS = {
  idle: 'idle',
  waiting: 'waiting',
  loading: 'loading',
  results: 'results',
  empty: 'empty',
  error: 'error',
} as const;

export type SearchStatus = (typeof SEARCH_STATUS)[keyof typeof SEARCH_STATUS];

export const SEARCH_ERROR_TYPES = {
  timeout: 'timeout',
  http: 'http',
  network: 'network',
  invalidResponse: 'invalid-response',
} as const;

export type SearchErrorType =
  (typeof SEARCH_ERROR_TYPES)[keyof typeof SEARCH_ERROR_TYPES];

export type SearchState =
  | { readonly status: typeof SEARCH_STATUS.idle }
  | {
      readonly status:
        typeof SEARCH_STATUS.waiting | typeof SEARCH_STATUS.loading;
      readonly query: string;
    }
  | {
      readonly status: typeof SEARCH_STATUS.results;
      readonly query: string;
      readonly countries: readonly Country[];
    }
  | { readonly status: typeof SEARCH_STATUS.empty; readonly query: string }
  | {
      readonly status: typeof SEARCH_STATUS.error;
      readonly query: string;
      readonly errorType: SearchErrorType;
      readonly message: string;
      readonly statusCode: number | null;
    };
