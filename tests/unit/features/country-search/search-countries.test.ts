import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ValidationError } from '@/features/country-search/application/search-errors';
import type { Country } from '@/features/country-search/domain/country.type';
import { searchCountries } from '@/features/country-search/infrastructure/search-countries.adapter';

const REQUEST_TIMEOUT_MS: number = 10_000;

beforeEach((): void => {
  vi.useFakeTimers();
});

afterEach((): void => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('searchCountries', (): void => {
  it('trims and encodes the query and passes a request signal to fetch', async (): Promise<void> => {
    const fetchMock: ReturnType<typeof vi.spyOn> = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('[]', { status: 200 }));
    const callerController: AbortController = new AbortController();

    await expect(
      searchCountries('  New Zealand / South  ', callerController.signal),
    ).resolves.toEqual([]);

    expect(fetchMock).toHaveBeenCalledWith(
      'https://countries.dev/name/New%20Zealand%20%2F%20South',
      expect.objectContaining({
        method: 'GET',
      }),
    );

    expect(vi.getTimerCount()).toBe(0);
  });

  it('returns an empty list without fetching a blank query', async (): Promise<void> => {
    const fetchMock: ReturnType<typeof vi.spyOn> = vi.spyOn(
      globalThis,
      'fetch',
    );

    await expect(
      searchCountries('  ', new AbortController().signal),
    ).resolves.toEqual([]);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('rejects a pre-aborted caller signal before fetching', async (): Promise<void> => {
    const callerController: AbortController = new AbortController();
    const abortReason: DOMException = new DOMException(
      'Cancelled',
      'AbortError',
    );

    callerController.abort(abortReason);
    const fetchMock: ReturnType<typeof vi.spyOn> = vi.spyOn(
      globalThis,
      'fetch',
    );

    await expect(
      searchCountries('Japan', callerController.signal),
    ).rejects.toBe(abortReason);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('treats 404 as an empty result without parsing a body', async (): Promise<void> => {
    const notFoundResponse: Response = new Response(null, { status: 404 });
    const responseBodyReader: ReturnType<typeof vi.spyOn> = vi
      .spyOn(notFoundResponse, 'json')
      .mockRejectedValue(new Error('The response body must not be read.'));

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(notFoundResponse);

    await expect(
      searchCountries('No Such Country', new AbortController().signal),
    ).resolves.toEqual([]);

    expect(responseBodyReader).not.toHaveBeenCalled();
  });

  it('rejects non-404 HTTP errors with their status', async (): Promise<void> => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(null, { status: 503 }),
    );

    await expect(
      searchCountries('Japan', new AbortController().signal),
    ).rejects.toMatchObject({ name: 'HttpError', statusCode: 503 });
  });

  it('converts malformed JSON and invalid country responses to ValidationError', async (): Promise<void> => {
    const malformedJsonResponse: Response = new Response('{', { status: 200 });

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(malformedJsonResponse);

    await expect(
      searchCountries('Japan', new AbortController().signal),
    ).rejects.toBeInstanceOf(ValidationError);

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('[{"capital":"Tokyo"}]', { status: 200 }),
    );

    await expect(
      searchCountries('Japan', new AbortController().signal),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('preserves network errors that happen while reading the response body', async (): Promise<void> => {
    const response: Response = new Response();
    const networkError: TypeError = new TypeError('Connection lost.');

    vi.spyOn(response, 'json').mockRejectedValue(networkError);
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(response);

    await expect(
      searchCountries('Japan', new AbortController().signal),
    ).rejects.toBe(networkError);
  });

  it('aborts a pending fetch when the caller cancels', async (): Promise<void> => {
    const callerController: AbortController = new AbortController();
    const requestSignals: AbortSignal[] = [];
    const fetchMock: ReturnType<typeof vi.spyOn> = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(
        (_input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
          const requestSignal: AbortSignal | null = init?.signal ?? null;

          if (requestSignal !== null) {
            requestSignals.push(requestSignal);
          }

          return new Promise<Response>(
            (
              _resolve: (value: Response | PromiseLike<Response>) => void,
              reject: (reason?: Error) => void,
            ): void => {
              requestSignal?.addEventListener(
                'abort',
                (): void => {
                  const abortReason: unknown = requestSignal?.reason;

                  reject(
                    abortReason instanceof Error
                      ? abortReason
                      : new Error('The request was aborted.'),
                  );
                },
                { once: true },
              );
            },
          );
        },
      );
    const searchPromise: Promise<readonly Country[]> = searchCountries(
      'Japan',
      callerController.signal,
    );
    const abortReason: DOMException = new DOMException(
      'Cancelled',
      'AbortError',
    );

    callerController.abort(abortReason);

    await expect(searchPromise).rejects.toBe(abortReason);
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(requestSignals[0]?.aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('aborts while reading the response body at the request deadline', async (): Promise<void> => {
    const callerController: AbortController = new AbortController();
    let requestSignal: AbortSignal | undefined;
    const fetchMock: ReturnType<typeof vi.spyOn> = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(
        (_input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
          requestSignal = init?.signal ?? undefined;

          const response: Response = new Response();

          response.json = (): Promise<unknown> =>
            new Promise<unknown>(
              (
                _resolve: (value: unknown) => void,
                reject: (reason?: Error) => void,
              ): void => {
                requestSignal?.addEventListener(
                  'abort',
                  (): void => {
                    const abortReason: unknown = requestSignal?.reason;

                    reject(
                      abortReason instanceof Error
                        ? abortReason
                        : new Error('The request was aborted.'),
                    );
                  },
                  { once: true },
                );
              },
            );

          return Promise.resolve(response);
        },
      );
    const searchPromise: Promise<readonly Country[]> = searchCountries(
      'Japan',
      callerController.signal,
    );
    const searchError: Promise<unknown> = searchPromise.catch(
      (error: unknown): unknown => error,
    );

    await Promise.resolve();
    expect(fetchMock).toHaveBeenCalledOnce();

    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS);

    await expect(searchError).resolves.toMatchObject({ name: 'TimeoutError' });
    expect(requestSignal?.aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });
});
