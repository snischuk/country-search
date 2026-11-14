import {
  HttpError,
  ValidationError,
} from '@/features/country-search/application/search-errors';
import type { Country } from '@/features/country-search/domain/country.type';
import { createAbortSignalWithTimeout } from '@/features/country-search/infrastructure/http/abort-signal.adapter';
import { mapCountryResponse } from '@/features/country-search/infrastructure/http/map-country-response';

const COUNTRIES_API_URL: string = 'https://countries.dev/name';
const HTTP_GET_METHOD: string = 'GET';
const HTTP_NOT_FOUND_STATUS: number = 404;
const REQUEST_TIMEOUT_MS: number = 10_000;

export async function searchCountries(
  query: string,
  signal: AbortSignal,
): Promise<readonly Country[]> {
  const normalizedQuery: string = query.trim();

  if (signal.aborted) {
    throw getAbortReason(signal);
  }

  if (normalizedQuery.length === 0) {
    return [];
  }

  const requestUrl: string = `${COUNTRIES_API_URL}/${encodeURIComponent(normalizedQuery)}`;
  const abortContext: ReturnType<typeof createAbortSignalWithTimeout> =
    createAbortSignalWithTimeout(signal, REQUEST_TIMEOUT_MS);

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
      throw getAbortReason(abortContext.signal);
    }

    throw error;
  } finally {
    abortContext.cleanup();
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
      throw getAbortReason(signal);
    }

    if (error instanceof SyntaxError) {
      throw new ValidationError('The country service returned invalid JSON.');
    }

    throw error;
  }
}

function getAbortReason(signal: AbortSignal): Error {
  const abortReason: unknown = signal.reason;

  return abortReason instanceof Error ? abortReason : createAbortError();
}
