import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  SEARCH_STATUS,
  createBrowserTimerDriver,
  createDebounceSchedulerFactory,
  createSearchController,
  searchCountries,
} from '@/features/country-search';
import type {
  SearchController,
  SearchPort,
  SearchState,
  SearchView,
} from '@/features/country-search';
import { createCachedSearchPort } from '@/features/country-search/infrastructure/cached-search.adapter';

interface RecordedRequest {
  readonly query: string;
  readonly signal: AbortSignal;
  readonly responseDueAtMilliseconds: number;
  rejectionName: string | null;
}

beforeEach((): void => {
  vi.useFakeTimers();
  vi.setSystemTime(0);
  vi.stubGlobal('window', {
    setTimeout: globalThis.setTimeout,
    clearTimeout: globalThis.clearTimeout,
  });
});

afterEach((): void => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('country search request race', (): void => {
  it.each([false, true])(
    'aborts the earlier transport before debounce and keeps only the latest result (cache: %s)',
    async (shouldUseCache: boolean): Promise<void> => {
      const requests: RecordedRequest[] = [];
      const deliveredQueries: string[] = [];
      const renderedStates: SearchState[] = [];
      const fetchMock: ReturnType<typeof vi.spyOn> = vi
        .spyOn(globalThis, 'fetch')
        .mockImplementation(
          (
            input: RequestInfo | URL,
            options?: RequestInit,
          ): Promise<Response> => {
            const requestUrl: string =
              typeof input === 'string'
                ? input
                : input instanceof URL
                  ? input.href
                  : input.url;
            const query: string =
              new URL(requestUrl).pathname.split('/').at(-1) ?? '';
            const signal: AbortSignal | null | undefined = options?.signal;

            if (!signal) {
              throw new Error('The transport must provide an abort signal.');
            }

            const requestSignal: AbortSignal = signal;
            const responseDelayMilliseconds: number =
              query === 'sp' ? 1000 : 100;
            const request: RecordedRequest = {
              query,
              signal: requestSignal,
              responseDueAtMilliseconds: Date.now() + responseDelayMilliseconds,
              rejectionName: null,
            };

            requests.push(request);

            return new Promise<Response>(
              (
                resolve: (response: Response) => void,
                reject: (error: unknown) => void,
              ): void => {
                const responseTimer: ReturnType<typeof setTimeout> = setTimeout(
                  (): void => {
                    requestSignal.removeEventListener('abort', abortRequest);
                    deliveredQueries.push(query);
                    resolve(
                      new Response(
                        JSON.stringify([
                          {
                            name: query === 'spain' ? 'Spain' : 'Stale country',
                          },
                        ]),
                        { status: 200 },
                      ),
                    );
                  },
                  responseDelayMilliseconds,
                );

                function abortRequest(): void {
                  clearTimeout(responseTimer);
                  requestSignal.removeEventListener('abort', abortRequest);
                  request.rejectionName = 'AbortError';
                  reject(
                    new DOMException(
                      'The request was cancelled.',
                      'AbortError',
                    ),
                  );
                }

                if (requestSignal.aborted) {
                  abortRequest();
                } else {
                  requestSignal.addEventListener('abort', abortRequest, {
                    once: true,
                  });
                }
              },
            );
          },
        );
      const view: SearchView = {
        render(state: SearchState): void {
          renderedStates.push(state);
        },
      };
      const transport: SearchPort = { search: searchCountries };
      const searchPort: SearchPort = shouldUseCache
        ? createCachedSearchPort(transport)
        : transport;
      const controller: SearchController = createSearchController(
        searchPort,
        view,
        createDebounceSchedulerFactory(createBrowserTimerDriver()),
      );

      try {
        controller.updateSearchQuery('sp');

        await vi.advanceTimersByTimeAsync(300);

        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(renderedStates.at(-1)).toEqual({
          status: SEARCH_STATUS.loading,
          query: 'sp',
        });

        await vi.advanceTimersByTimeAsync(100);

        controller.updateSearchQuery('spain');

        expect(requests[0]?.signal.aborted).toBe(true);
        expect(requests[0]?.rejectionName).toBe('AbortError');
        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(renderedStates.at(-1)).toEqual({
          status: SEARCH_STATUS.waiting,
          query: 'spain',
        });

        await vi.advanceTimersByTimeAsync(299);

        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(renderedStates.at(-1)).toEqual({
          status: SEARCH_STATUS.waiting,
          query: 'spain',
        });

        await vi.advanceTimersByTimeAsync(1);

        expect(fetchMock).toHaveBeenCalledTimes(2);
        expect(
          requests.map((request: RecordedRequest): string => request.query),
        ).toEqual(['sp', 'spain']);

        expect(requests[0]?.responseDueAtMilliseconds).toBe(1300);
        expect(requests[1]?.responseDueAtMilliseconds).toBe(800);
        expect(renderedStates.at(-1)).toEqual({
          status: SEARCH_STATUS.loading,
          query: 'spain',
        });

        await vi.advanceTimersByTimeAsync(100);

        expect(renderedStates.at(-1)).toMatchObject({
          status: SEARCH_STATUS.results,
          query: 'spain',
          countries: [{ name: 'Spain' }],
        });

        const renderCountAfterLatestResult: number = renderedStates.length;

        await vi.advanceTimersByTimeAsync(1000);

        expect(deliveredQueries).toEqual(['spain']);
        expect(renderedStates).toHaveLength(renderCountAfterLatestResult);
        expect(
          renderedStates.some(
            (state: SearchState): boolean =>
              state.status === SEARCH_STATUS.error,
          ),
        ).toBe(false);

        expect(vi.getTimerCount()).toBe(0);
      } finally {
        controller.destroy();
      }
    },
  );
});
