import { HttpError, ValidationError } from '../../application/search-errors';
import type { SearchCancellationSignal } from '../../application/search.port';
import type { Country } from '../../domain/country.type';

import { createAbortSignalWithTimeout } from './abort-signal.adapter';
import { mapCountryResponse } from './map-country-response';

const COUNTRIES_API_URL: string = 'https://countries.dev/name';
const HTTP_GET_METHOD: string = 'GET';
const HTTP_NOT_FOUND_STATUS: number = 404;
const REQUEST_TIMEOUT_MS: number = 10_000;

export function searchCountries(
  query: string,
  cancellationSignal: SearchCancellationSignal,
): Promise<readonly Country[]> {
  const normalizedQuery: string = query.trim();

  if (cancellationSignal.isCancelled) {
    return Promise.reject(createAbortError());
  }

  if (normalizedQuery.length === 0) {
    return Promise.resolve([]);
  }

  const callerController: AbortController = new AbortController();
  const removeCancellationCallback: () => void = cancellationSignal.onCancel(
    (): void => {
      callerController.abort();
    },
  );

  if (cancellationSignal.isCancelled) {
    removeCancellationCallback();

    return Promise.reject(createAbortError());
  }

  return fetchCountries(
    normalizedQuery,
    callerController.signal,
    removeCancellationCallback,
  );
}

async function fetchCountries(
  normalizedQuery: string,
  callerSignal: AbortSignal,
  removeCancellationCallback: () => void,
): Promise<readonly Country[]> {
  const requestUrl: string = `${COUNTRIES_API_URL}/${encodeURIComponent(normalizedQuery)}`;
  const abortContext: ReturnType<typeof createAbortSignalWithTimeout> =
    createAbortSignalWithTimeout(callerSignal, REQUEST_TIMEOUT_MS);

  try {
    const response: Response = await fetch(requestUrl, {
      method: HTTP_GET_METHOD,
      signal: abortContext.signal,
    });

    if (response.status === HTTP_NOT_FOUND_STATUS) {
      return [];
    }

    if (!response.ok) {
      throw new HttpError(response.status);
    }

    const rawCountries: unknown = await parseJson(
      response,
      abortContext.signal,
    );

    if (!Array.isArray(rawCountries)) {
      throw new ValidationError(
        'The country service response must be an array.',
      );
    }

    return rawCountries.map((rawCountry: unknown): Country =>
      mapCountryResponse(rawCountry),
    );
  } catch (error: unknown) {
    if (abortContext.signal.aborted) {
      const abortReason: unknown = abortContext.signal.reason;

      throw abortReason instanceof Error
        ? abortReason
        : new DOMException('The request was cancelled.', 'AbortError');
    }

    if (error instanceof ValidationError || error instanceof HttpError) {
      throw error;
    }

    throw error;
  } finally {
    abortContext.cleanup();
    removeCancellationCallback();
  }
}

function createAbortError(): DOMException {
  return new DOMException('The request was cancelled.', 'AbortError');
}

async function parseJson(
  response: Response,
  signal: AbortSignal,
): Promise<unknown> {
  try {
    return await response.json();
  } catch (error: unknown) {
    if (signal.aborted) {
      const abortReason: unknown = signal.reason;

      throw abortReason instanceof Error
        ? abortReason
        : new DOMException('The request was cancelled.', 'AbortError');
    }

    if (error instanceof SyntaxError) {
      throw new ValidationError('The country service returned invalid JSON.');
    }

    throw error;
  }
}
