import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  SEARCH_ERROR_TYPES,
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

interface PendingHttpRequest {
  readonly query: string;
  readonly signal: AbortSignal;
  abortCount: number;
  resolve(payload: readonly unknown[], statusCode?: number): void;
  reject(error: Error): void;
}

interface ControllerProbe {
  readonly controller: SearchController;
  readonly states: SearchState[];
}

interface CachedSearchSetup {
  readonly requests: PendingHttpRequest[];
  readonly controllers: ControllerProbe[];
  createController(): ControllerProbe;
}

const activeSetups: CachedSearchSetup[] = [];

function createCachedSearchSetup(
  shouldHonorAbort: boolean = true,
): CachedSearchSetup {
  const requests: PendingHttpRequest[] = [];
  const controllers: ControllerProbe[] = [];

  vi.spyOn(globalThis, 'fetch').mockImplementation(
    (input: RequestInfo | URL, options?: RequestInit): Promise<Response> => {
      const url: string =
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.href
            : input.url;

      const signal: AbortSignal | null | undefined = options?.signal;

      if (!signal) {
        throw new Error('Transport must provide a signal.');
      }

      const requestSignal: AbortSignal = signal;

      return new Promise<Response>(
        (
          resolve: (response: Response) => void,
          reject: (error: Error) => void,
        ): void => {
          const request: PendingHttpRequest = {
            query: decodeURIComponent(
              new URL(url).pathname.split('/').at(-1) ?? '',
            ),
            signal: requestSignal,
            abortCount: 0,
            resolve(
              payload: readonly unknown[],
              statusCode: number = 200,
            ): void {
              requestSignal.removeEventListener('abort', abortRequest);
              resolve(
                new Response(JSON.stringify(payload), { status: statusCode }),
              );
            },
            reject(error: Error): void {
              requestSignal.removeEventListener('abort', abortRequest);
              reject(error);
            },
          };

          function abortRequest(): void {
            request.abortCount++;
            if (shouldHonorAbort) {
              request.reject(new DOMException('Cancelled', 'AbortError'));
            }
          }

          requests.push(request);
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

  const transport: SearchPort = { search: searchCountries };
  const cache: SearchPort = createCachedSearchPort(transport);
  const setup: CachedSearchSetup = {
    requests,
    controllers,
    createController(): ControllerProbe {
      const states: SearchState[] = [];
      const view: SearchView = {
        render(state: SearchState): void {
          states.push(state);
        },
      };
      const controller: SearchController = createSearchController(
        cache,
        view,
        createDebounceSchedulerFactory(createBrowserTimerDriver()),
      );
      const probe: ControllerProbe = { controller, states };

      controllers.push(probe);

      return probe;
    },
  };

  activeSetups.push(setup);

  return setup;
}

async function resolvePendingWork(): Promise<void> {
  await vi.advanceTimersByTimeAsync(0);
}

beforeEach((): void => {
  vi.useFakeTimers();
  vi.stubGlobal('window', {
    setTimeout: globalThis.setTimeout,
    clearTimeout: globalThis.clearTimeout,
  });
});

afterEach(async (): Promise<void> => {
  activeSetups.splice(0).forEach((setup: CachedSearchSetup): void => {
    setup.controllers.forEach((probe: ControllerProbe): void => {
      probe.controller.destroy();
    });

    setup.requests.forEach((request: PendingHttpRequest): void => {
      request.resolve([]);
    });
  });

  await resolvePendingWork();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('controller through completed cache and HTTP transport', (): void => {
  it('reuses the mapped result after another query without another HTTP request', async (): Promise<void> => {
    const setup: CachedSearchSetup = createCachedSearchSetup();
    const { controller, states }: ControllerProbe = setup.createController();

    controller.updateSearchQuery('Japan');
    await vi.advanceTimersByTimeAsync(300);
    setup.requests[0]?.resolve([{ name: 'Japan', capital: 'Tokyo' }]);
    await resolvePendingWork();
    controller.updateSearchQuery('Canada');
    await vi.advanceTimersByTimeAsync(300);
    setup.requests[1]?.resolve([{ name: 'Canada' }]);
    await resolvePendingWork();
    controller.updateSearchQuery(' Japan ');
    await vi.advanceTimersByTimeAsync(300);

    expect(setup.requests).toHaveLength(2);
    expect(states.at(-1)).toMatchObject({
      status: SEARCH_STATUS.results,
      query: 'Japan',
      countries: [{ name: 'Japan', capital: 'Tokyo' }],
    });

    expect(vi.getTimerCount()).toBe(0);
  });

  it('caches HTTP 404 as an empty result without a repeated fetch', async (): Promise<void> => {
    const setup: CachedSearchSetup = createCachedSearchSetup();
    const { controller, states }: ControllerProbe = setup.createController();

    controller.updateSearchQuery('missing');
    await vi.advanceTimersByTimeAsync(300);
    setup.requests[0]?.resolve([], 404);
    await resolvePendingWork();
    controller.updateSearchQuery(' missing ');
    await vi.advanceTimersByTimeAsync(300);

    expect(setup.requests).toHaveLength(1);
    expect(states.at(-1)).toEqual({
      status: SEARCH_STATUS.empty,
      query: 'missing',
    });

    expect(
      states.some(
        (state: SearchState): boolean => state.status === SEARCH_STATUS.error,
      ),
    ).toBe(false);
  });

  it('keeps the shared HTTP request alive when only one controller clears', async (): Promise<void> => {
    const setup: CachedSearchSetup = createCachedSearchSetup();
    const first: ControllerProbe = setup.createController();
    const second: ControllerProbe = setup.createController();

    first.controller.updateSearchQuery('Japan');
    second.controller.updateSearchQuery(' Japan ');
    await vi.advanceTimersByTimeAsync(300);

    expect(setup.requests).toHaveLength(1);
    first.controller.updateSearchQuery('');
    expect(setup.requests[0]?.signal.aborted).toBe(false);
    expect(first.states.at(-1)).toEqual({ status: SEARCH_STATUS.idle });
    expect(second.states.at(-1)).toEqual({
      status: SEARCH_STATUS.loading,
      query: 'Japan',
    });

    setup.requests[0]?.resolve([{ name: 'Japan' }]);
    await resolvePendingWork();
    expect(second.states.at(-1)).toMatchObject({
      status: SEARCH_STATUS.results,
      query: 'Japan',
    });

    expect(first.states.at(-1)).toEqual({ status: SEARCH_STATUS.idle });
    expect(setup.requests[0]?.abortCount).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('aborts the last consumer immediately and restarts the same key before old rejection settles', async (): Promise<void> => {
    const setup: CachedSearchSetup = createCachedSearchSetup();
    const first: ControllerProbe = setup.createController();
    const second: ControllerProbe = setup.createController();

    first.controller.updateSearchQuery('Japan');
    second.controller.updateSearchQuery('Japan');
    await vi.advanceTimersByTimeAsync(300);
    first.controller.updateSearchQuery('');
    second.controller.updateSearchQuery('');

    expect(setup.requests[0]?.signal.aborted).toBe(true);
    expect(setup.requests[0]?.abortCount).toBe(1);
    first.controller.updateSearchQuery('Japan');
    first.controller.retrySearch();
    expect(setup.requests).toHaveLength(2);
    expect(setup.requests[1]?.signal.aborted).toBe(false);
    setup.requests[1]?.resolve([{ name: 'Fresh Japan' }]);
    await resolvePendingWork();
    expect(first.states.at(-1)).toMatchObject({
      status: SEARCH_STATUS.results,
      countries: [{ name: 'Fresh Japan' }],
    });

    expect(second.states.at(-1)).toEqual({ status: SEARCH_STATUS.idle });
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each([false, true])(
    'keeps new same-key work after stale HTTP completion (success: %s)',
    async (shouldResolveStale: boolean): Promise<void> => {
      const setup: CachedSearchSetup = createCachedSearchSetup(false);
      const first: ControllerProbe = setup.createController();

      first.controller.updateSearchQuery('Japan');
      await vi.advanceTimersByTimeAsync(300);
      first.controller.updateSearchQuery('');
      first.controller.updateSearchQuery('Japan');
      first.controller.retrySearch();
      expect(setup.requests).toHaveLength(2);
      expect(setup.requests[0]?.signal.aborted).toBe(true);
      if (shouldResolveStale) {
        setup.requests[0]?.resolve([{ name: 'Stale country' }]);
      } else {
        setup.requests[0]?.reject(new TypeError('Late network failure'));
      }

      await resolvePendingWork();
      expect(first.states.at(-1)).toEqual({
        status: SEARCH_STATUS.loading,
        query: 'Japan',
      });

      const second: ControllerProbe = setup.createController();

      second.controller.updateSearchQuery('Japan');
      await vi.advanceTimersByTimeAsync(300);
      expect(setup.requests).toHaveLength(2);
      setup.requests[1]?.resolve([{ name: 'Fresh country' }]);
      await resolvePendingWork();
      expect(first.states.at(-1)).toMatchObject({
        status: SEARCH_STATUS.results,
        countries: [{ name: 'Fresh country' }],
      });

      expect(second.states.at(-1)).toMatchObject({
        status: SEARCH_STATUS.results,
        countries: [{ name: 'Fresh country' }],
      });

      first.controller.retrySearch();
      await resolvePendingWork();
      expect(setup.requests).toHaveLength(2);
      expect(first.states.at(-1)).toMatchObject({
        status: SEARCH_STATUS.results,
        countries: [{ name: 'Fresh country' }],
      });

      expect(vi.getTimerCount()).toBe(0);
    },
  );

  it('does not cache a network failure and lets retry recover through HTTP', async (): Promise<void> => {
    const setup: CachedSearchSetup = createCachedSearchSetup();
    const { controller, states }: ControllerProbe = setup.createController();

    controller.updateSearchQuery('Japan');
    await vi.advanceTimersByTimeAsync(300);
    setup.requests[0]?.reject(new TypeError('Failed to fetch'));
    await resolvePendingWork();
    expect(states.at(-1)).toMatchObject({
      status: SEARCH_STATUS.error,
      errorType: SEARCH_ERROR_TYPES.network,
    });

    controller.retrySearch();
    expect(setup.requests).toHaveLength(2);
    setup.requests[1]?.resolve([{ name: 'Japan' }]);
    await resolvePendingWork();
    expect(states.at(-1)).toMatchObject({
      status: SEARCH_STATUS.results,
      countries: [{ name: 'Japan' }],
    });
  });
});
