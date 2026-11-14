import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Mock } from 'vitest';

import {
  SEARCH_ERROR_TYPES,
  SEARCH_STATUS,
  createCachedSearchPort,
  createSearchCountriesAdapter,
} from '@/features/country-search';
import type { SearchPort } from '@/features/country-search';

import { createDeferred } from '../support/deferred';
import type { Deferred } from '../support/deferred';
import {
  createJsonResponse,
  getRequestSignal,
  waitForAbort,
} from '../support/http';
import { createControllerSetup } from '../support/search-controller';

beforeEach((): void => {
  vi.useFakeTimers();
});

afterEach((): void => {
  vi.clearAllTimers();
  vi.useRealTimers();
});

describe('controller, cache and HTTP integration', (): void => {
  it('reuses mapped countries after another query without another fetch', async (): Promise<void> => {
    const fetchRequest: Mock<typeof fetch> = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        createJsonResponse([{ name: 'Japan', capital: 'Tokyo' }]),
      )
      .mockResolvedValueOnce(createJsonResponse([{ name: 'Canada' }]));
    const cache: SearchPort = createCachedSearchPort(
      createSearchCountriesAdapter(),
    );
    const { controller, render }: ReturnType<typeof createControllerSetup> =
      createControllerSetup(undefined, cache);

    controller.updateSearchQuery('Japan');
    await vi.advanceTimersByTimeAsync(300);
    controller.updateSearchQuery('Canada');
    await vi.advanceTimersByTimeAsync(300);
    controller.updateSearchQuery(' Japan ');
    await vi.advanceTimersByTimeAsync(300);

    expect(fetchRequest).toHaveBeenCalledTimes(2);
    expect(render).toHaveBeenLastCalledWith(
      expect.objectContaining({
        status: SEARCH_STATUS.results,
        query: 'Japan',
        countries: [
          expect.objectContaining({ name: 'Japan', capital: 'Tokyo' }),
        ],
      }),
      null,
    );

    expect(vi.getTimerCount()).toBe(0);
  });

  it('caches HTTP 404 as an empty result', async (): Promise<void> => {
    const fetchRequest: Mock<typeof fetch> = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('not JSON', { status: 404 }));
    const cache: SearchPort = createCachedSearchPort(
      createSearchCountriesAdapter(),
    );
    const { controller, render }: ReturnType<typeof createControllerSetup> =
      createControllerSetup(undefined, cache);

    controller.updateSearchQuery('missing');
    await vi.advanceTimersByTimeAsync(300);
    controller.updateSearchQuery(' missing ');
    await vi.advanceTimersByTimeAsync(300);

    expect(fetchRequest).toHaveBeenCalledTimes(1);
    expect(render).toHaveBeenLastCalledWith(
      { status: SEARCH_STATUS.empty, query: 'missing' },
      null,
    );
  });

  it('keeps shared HTTP work alive when one controller clears its input', async (): Promise<void> => {
    const response: Deferred<Response> = createDeferred();
    const fetchRequest: Mock<typeof fetch> = vi
      .spyOn(globalThis, 'fetch')
      .mockReturnValue(response.promise);
    const cache: SearchPort = createCachedSearchPort(
      createSearchCountriesAdapter(),
    );
    const first: ReturnType<typeof createControllerSetup> =
      createControllerSetup(undefined, cache);
    const second: ReturnType<typeof createControllerSetup> =
      createControllerSetup(undefined, cache);

    first.controller.updateSearchQuery('Japan');
    second.controller.updateSearchQuery(' Japan ');
    await vi.advanceTimersByTimeAsync(300);
    first.controller.updateSearchQuery('');

    expect(fetchRequest).toHaveBeenCalledTimes(1);
    expect(fetchRequest.mock.calls[0]?.[1]?.signal?.aborted).toBe(false);
    expect(second.render).toHaveBeenLastCalledWith(
      { status: SEARCH_STATUS.loading, query: 'Japan' },
      null,
    );

    response.resolve(createJsonResponse([{ name: 'Japan' }]));
    await vi.advanceTimersByTimeAsync(0);

    expect(first.render).toHaveBeenLastCalledWith(
      { status: SEARCH_STATUS.idle },
      null,
    );

    expect(second.render).toHaveBeenLastCalledWith(
      expect.objectContaining({
        status: SEARCH_STATUS.results,
        query: 'Japan',
      }),
      null,
    );

    expect(vi.getTimerCount()).toBe(0);
  });

  it('aborts the last consumer immediately and allows a same-key restart', async (): Promise<void> => {
    const fetchRequest: Mock<typeof fetch> = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementationOnce(
        (_input: RequestInfo | URL, options?: RequestInit): Promise<Response> =>
          waitForAbort(getRequestSignal(options)),
      )
      .mockResolvedValueOnce(createJsonResponse([{ name: 'Fresh Japan' }]));
    const cache: SearchPort = createCachedSearchPort(
      createSearchCountriesAdapter(),
    );
    const first: ReturnType<typeof createControllerSetup> =
      createControllerSetup(undefined, cache);
    const second: ReturnType<typeof createControllerSetup> =
      createControllerSetup(undefined, cache);

    first.controller.updateSearchQuery('Japan');
    second.controller.updateSearchQuery('Japan');
    await vi.advanceTimersByTimeAsync(300);
    first.controller.updateSearchQuery('');
    expect(fetchRequest.mock.calls[0]?.[1]?.signal?.aborted).toBe(false);
    second.controller.updateSearchQuery('');
    expect(fetchRequest.mock.calls[0]?.[1]?.signal?.aborted).toBe(true);
    first.controller.searchFromHistory('Japan');
    expect(fetchRequest).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(0);

    expect(first.render).toHaveBeenLastCalledWith(
      expect.objectContaining({
        status: SEARCH_STATUS.results,
        countries: [expect.objectContaining({ name: 'Fresh Japan' })],
      }),
      null,
    );

    expect(second.render).toHaveBeenLastCalledWith(
      { status: SEARCH_STATUS.idle },
      null,
    );

    expect(vi.getTimerCount()).toBe(0);
  });

  it.each(['success', 'failure'])(
    'keeps a replacement request after stale HTTP %s',
    async (completion: string): Promise<void> => {
      const staleResponse: Deferred<Response> = createDeferred();
      const freshResponse: Deferred<Response> = createDeferred();
      const fetchRequest: Mock<typeof fetch> = vi
        .spyOn(globalThis, 'fetch')
        .mockReturnValueOnce(staleResponse.promise)
        .mockReturnValueOnce(freshResponse.promise);
      const cache: SearchPort = createCachedSearchPort(
        createSearchCountriesAdapter(),
      );
      const first: ReturnType<typeof createControllerSetup> =
        createControllerSetup(undefined, cache);

      first.controller.updateSearchQuery('Japan');
      await vi.advanceTimersByTimeAsync(300);
      first.controller.updateSearchQuery('');
      first.controller.searchFromHistory('Japan');

      expect(fetchRequest).toHaveBeenCalledTimes(2);
      expect(fetchRequest.mock.calls[0]?.[1]?.signal?.aborted).toBe(true);
      if (completion === 'success') {
        staleResponse.resolve(createJsonResponse([{ name: 'Stale country' }]));
      } else {
        staleResponse.reject(new TypeError('Late network failure'));
      }

      await vi.advanceTimersByTimeAsync(0);

      expect(first.render).toHaveBeenLastCalledWith(
        { status: SEARCH_STATUS.loading, query: 'Japan' },
        null,
      );

      const second: ReturnType<typeof createControllerSetup> =
        createControllerSetup(undefined, cache);

      second.controller.searchFromHistory('Japan');
      expect(fetchRequest).toHaveBeenCalledTimes(2);
      freshResponse.resolve(createJsonResponse([{ name: 'Fresh country' }]));
      await vi.advanceTimersByTimeAsync(0);

      expect(first.render).toHaveBeenLastCalledWith(
        expect.objectContaining({
          status: SEARCH_STATUS.results,
          countries: [expect.objectContaining({ name: 'Fresh country' })],
        }),
        null,
      );

      expect(second.render).toHaveBeenLastCalledWith(
        expect.objectContaining({
          status: SEARCH_STATUS.results,
          countries: [expect.objectContaining({ name: 'Fresh country' })],
        }),
        null,
      );

      first.controller.retrySearch();
      await vi.advanceTimersByTimeAsync(0);
      expect(fetchRequest).toHaveBeenCalledTimes(2);
      expect(first.render).toHaveBeenLastCalledWith(
        expect.objectContaining({
          status: SEARCH_STATUS.results,
          countries: [expect.objectContaining({ name: 'Fresh country' })],
        }),
        null,
      );

      expect(vi.getTimerCount()).toBe(0);
    },
  );

  it('recovers from an uncached network failure through retry', async (): Promise<void> => {
    const fetchRequest: Mock<typeof fetch> = vi
      .spyOn(globalThis, 'fetch')
      .mockRejectedValueOnce(new TypeError('Offline'))
      .mockResolvedValueOnce(createJsonResponse([{ name: 'Japan' }]));
    const cache: SearchPort = createCachedSearchPort(
      createSearchCountriesAdapter(),
    );
    const { controller, render }: ReturnType<typeof createControllerSetup> =
      createControllerSetup(undefined, cache);

    controller.updateSearchQuery('Japan');
    await vi.advanceTimersByTimeAsync(300);
    expect(render).toHaveBeenLastCalledWith(
      expect.objectContaining({
        status: SEARCH_STATUS.error,
        errorType: SEARCH_ERROR_TYPES.network,
      }),
      null,
    );

    controller.retrySearch();
    await vi.advanceTimersByTimeAsync(0);

    expect(fetchRequest).toHaveBeenCalledTimes(2);
    expect(render).toHaveBeenLastCalledWith(
      expect.objectContaining({
        status: SEARCH_STATUS.results,
        countries: [expect.objectContaining({ name: 'Japan' })],
      }),
      null,
    );

    expect(vi.getTimerCount()).toBe(0);
  });
});
