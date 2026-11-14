import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Mock } from 'vitest';

import {
  SEARCH_STATUS,
  createBrowserTimerDriver,
  createCachedSearchPort,
  createDebounceSchedulerFactory,
  createSearchController,
  createSearchCountriesAdapter,
} from '@/features/country-search';
import type {
  SearchController,
  SearchPort,
  SearchView,
} from '@/features/country-search';

import { createJsonResponse, getRequestSignal } from '../support/http';

function fetchDelayedCountry(
  input: RequestInfo | URL,
  options?: RequestInit,
): Promise<Response> {
  const signal: AbortSignal = getRequestSignal(options);
  const requestUrl: string =
    typeof input === 'string'
      ? input
      : input instanceof URL
        ? input.href
        : input.url;
  const isSlowRequest: boolean = requestUrl.endsWith('/sp');

  return new Promise<Response>(
    (
      resolve: (response: Response) => void,
      reject: (error: unknown) => void,
    ): void => {
      const timer: ReturnType<typeof setTimeout> = setTimeout(
        (): void => {
          signal.removeEventListener('abort', abortRequest);
          resolve(
            createJsonResponse([
              { name: isSlowRequest ? 'Stale country' : 'Spain' },
            ]),
          );
        },
        isSlowRequest ? 1000 : 100,
      );

      function abortRequest(): void {
        clearTimeout(timer);
        reject(new DOMException('Cancelled', 'AbortError'));
      }

      if (signal.aborted) {
        abortRequest();
      } else {
        signal.addEventListener('abort', abortRequest, { once: true });
      }
    },
  );
}

beforeEach((): void => {
  vi.useFakeTimers();
  vi.stubGlobal('window', {
    setTimeout: globalThis.setTimeout,
    clearTimeout: globalThis.clearTimeout,
  });
});

afterEach((): void => {
  vi.clearAllTimers();
  vi.useRealTimers();
});

describe('country search request race', (): void => {
  it.each([false, true])(
    'aborts the slow request before debounce and displays only the faster response (cache: %s)',
    async (shouldUseCache: boolean): Promise<void> => {
      const fetchRequest: Mock<typeof fetch> = vi
        .spyOn(globalThis, 'fetch')
        .mockImplementation(fetchDelayedCountry);
      const render: Mock<SearchView['render']> = vi.fn();
      const transport: SearchPort = createSearchCountriesAdapter();
      const controller: SearchController = createSearchController(
        shouldUseCache ? createCachedSearchPort(transport) : transport,
        { render },
        createDebounceSchedulerFactory(createBrowserTimerDriver()),
      );

      controller.updateSearchQuery('sp');
      await vi.advanceTimersByTimeAsync(300);
      expect(render).toHaveBeenLastCalledWith(
        { status: SEARCH_STATUS.loading, query: 'sp' },
        null,
      );

      const slowFetch: unknown = fetchRequest.mock.results[0]?.value;
      const abortAssertion: Promise<void> = expect(
        slowFetch,
      ).rejects.toMatchObject({ name: 'AbortError' });

      await vi.advanceTimersByTimeAsync(100);
      controller.updateSearchQuery('spain');

      expect(fetchRequest.mock.calls[0]?.[1]?.signal?.aborted).toBe(true);
      expect(fetchRequest).toHaveBeenCalledTimes(1);
      expect(render).toHaveBeenLastCalledWith(
        { status: SEARCH_STATUS.waiting, query: 'spain' },
        null,
      );

      await abortAssertion;
      await vi.advanceTimersByTimeAsync(299);
      expect(fetchRequest).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(1);
      expect(fetchRequest).toHaveBeenCalledTimes(2);
      expect(fetchRequest.mock.calls[1]?.[0]).toBe(
        'https://countries.dev/name/spain',
      );

      expect(render).toHaveBeenLastCalledWith(
        { status: SEARCH_STATUS.loading, query: 'spain' },
        null,
      );

      await vi.advanceTimersByTimeAsync(100);

      expect(render).toHaveBeenLastCalledWith(
        expect.objectContaining({
          status: SEARCH_STATUS.results,
          query: 'spain',
          countries: [expect.objectContaining({ name: 'Spain' })],
        }),
        null,
      );

      expect(render).not.toHaveBeenCalledWith(
        expect.objectContaining({ status: SEARCH_STATUS.error }),
        null,
      );

      render.mockClear();
      await vi.advanceTimersByTimeAsync(1000);
      expect(render).not.toHaveBeenCalled();
      expect(vi.getTimerCount()).toBe(0);
      controller.destroy();
    },
  );
});
