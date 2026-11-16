import { describe, expect, it, vi } from 'vitest';
import type { Mock } from 'vitest';

import { createSearchCancellationSource } from '@/features/country-search/application/search-cancellation';
import {
  HttpError,
  ValidationError,
} from '@/features/country-search/application/search-errors';
import type {
  SearchCancellationSignal,
  SearchCancellationSource,
  SearchPort,
} from '@/features/country-search/application/search.port';
import type { Country } from '@/features/country-search/domain/country.type';
import { createCachedSearchPort } from '@/features/country-search/infrastructure/cached-search.adapter';

import { createCountry } from '../../../support/country';
import { createDeferred } from '../../../support/deferred';
import type { Deferred } from '../../../support/deferred';

function createSharedSearch(): {
  readonly cache: SearchPort;
  readonly search: Mock<SearchPort['search']>;
  readonly response: Deferred<readonly Country[]>;
} {
  const response: Deferred<readonly Country[]> = createDeferred();
  const search: Mock<SearchPort['search']> = vi
    .fn<SearchPort['search']>()
    .mockReturnValue(response.promise);

  return { cache: createCachedSearchPort({ search }), search, response };
}

describe('shared in-flight searches', (): void => {
  it('shares one normalized request while returning independent promises', async (): Promise<void> => {
    const { cache, search, response }: ReturnType<typeof createSharedSearch> =
      createSharedSearch();
    const first: SearchCancellationSource = createSearchCancellationSource();
    const second: SearchCancellationSource = createSearchCancellationSource();
    const countries: readonly Country[] = [createCountry('Japan')];
    const firstResult: Promise<readonly Country[]> = cache.search(
      ' Japan ',
      first.signal,
    );
    const secondResult: Promise<readonly Country[]> = cache.search(
      'Japan',
      second.signal,
    );

    expect(firstResult).not.toBe(secondResult);
    expect(search).toHaveBeenCalledExactlyOnceWith('Japan', expect.anything());
    response.resolve(countries);
    await expect(firstResult).resolves.toEqual(countries);
    await expect(secondResult).resolves.toEqual(countries);
    first.cancel();
    second.cancel();
    expect(search.mock.calls[0]?.[1].isCancelled).toBe(false);
  });

  it('rejects an already cancelled caller without joining active work', async (): Promise<void> => {
    const { cache, search, response }: ReturnType<typeof createSharedSearch> =
      createSharedSearch();
    const cancelled: SearchCancellationSource =
      createSearchCancellationSource();
    const activeResult: Promise<readonly Country[]> = cache.search(
      'Japan',
      createSearchCancellationSource().signal,
    );

    cancelled.cancel();
    await expect(cache.search('Japan', cancelled.signal)).rejects.toMatchObject(
      { name: 'AbortError' },
    );

    expect(search).toHaveBeenCalledTimes(1);
    expect(search.mock.calls[0]?.[1].isCancelled).toBe(false);
    response.resolve([]);
    await expect(activeResult).resolves.toEqual([]);
  });

  it('cancels only one caller while the other receives the shared response', async (): Promise<void> => {
    const { cache, search, response }: ReturnType<typeof createSharedSearch> =
      createSharedSearch();
    const first: SearchCancellationSource = createSearchCancellationSource();
    const firstResult: Promise<readonly Country[]> = cache.search(
      'Japan',
      first.signal,
    );
    const secondResult: Promise<readonly Country[]> = cache.search(
      'Japan',
      createSearchCancellationSource().signal,
    );
    const countries: readonly Country[] = [createCountry('Japan')];

    first.cancel();
    await expect(firstResult).rejects.toMatchObject({ name: 'AbortError' });
    expect(search.mock.calls[0]?.[1].isCancelled).toBe(false);
    response.resolve(countries);
    await expect(secondResult).resolves.toEqual(countries);
  });

  it('cancels transport only after the last caller leaves and permits immediate restart', async (): Promise<void> => {
    const { cache, search, response }: ReturnType<typeof createSharedSearch> =
      createSharedSearch();
    const first: SearchCancellationSource = createSearchCancellationSource();
    const second: SearchCancellationSource = createSearchCancellationSource();
    const onTransportCancel: Mock<() => void> = vi.fn();
    const firstResult: Promise<readonly Country[]> = cache.search(
      'Japan',
      first.signal,
    );
    const secondResult: Promise<readonly Country[]> = cache.search(
      'Japan',
      second.signal,
    );

    search.mock.calls[0]?.[1].onCancel(onTransportCancel);
    const cancellations: Promise<unknown> = Promise.allSettled([
      firstResult,
      secondResult,
    ]);

    first.cancel();
    expect(onTransportCancel).not.toHaveBeenCalled();
    second.cancel();
    expect(onTransportCancel).toHaveBeenCalledTimes(1);
    search.mockResolvedValueOnce([createCountry('Fresh Japan')]);
    const restarted: Promise<readonly Country[]> = cache.search(
      'Japan',
      createSearchCancellationSource().signal,
    );

    expect(search).toHaveBeenCalledTimes(2);
    expect(search.mock.calls[1]?.[1].isCancelled).toBe(false);
    await expect(restarted).resolves.toEqual([createCountry('Fresh Japan')]);
    await expect(cancellations).resolves.toMatchObject([
      {
        status: 'rejected',
        reason: { name: 'AbortError' },
      },
      {
        status: 'rejected',
        reason: { name: 'AbortError' },
      },
    ]);

    response.resolve([]);
  });

  it.each([
    new DOMException('Deadline exceeded', 'TimeoutError'),
    new HttpError(503),
    new ValidationError(),
    new TypeError('Offline'),
  ])(
    'shares failure %s and starts a fresh retry',
    async (error: Error): Promise<void> => {
      const { cache, search, response }: ReturnType<typeof createSharedSearch> =
        createSharedSearch();
      const first: SearchCancellationSource = createSearchCancellationSource();
      const second: SearchCancellationSource = createSearchCancellationSource();
      const failures: Promise<PromiseSettledResult<readonly Country[]>[]> =
        Promise.allSettled([
          cache.search('Japan', first.signal),
          cache.search('Japan', second.signal),
        ]);

      response.reject(error);
      await expect(failures).resolves.toEqual([
        { status: 'rejected', reason: error },
        { status: 'rejected', reason: error },
      ]);

      first.cancel();
      second.cancel();
      expect(search.mock.calls[0]?.[1].isCancelled).toBe(false);
      search.mockResolvedValueOnce([]);
      await expect(
        cache.search('Japan', createSearchCancellationSource().signal),
      ).resolves.toEqual([]);

      expect(search).toHaveBeenCalledTimes(2);
    },
  );

  it.each(['success', 'failure'])(
    'keeps replacement work after obsolete %s',
    async (completion: string): Promise<void> => {
      const {
        cache,
        search,
        response: obsoleteResponse,
      }: ReturnType<typeof createSharedSearch> = createSharedSearch();
      const obsolete: SearchCancellationSource =
        createSearchCancellationSource();
      const obsoleteResult: Promise<readonly Country[]> = cache.search(
        'Japan',
        obsolete.signal,
      );
      const freshResponse: Deferred<readonly Country[]> = createDeferred();
      const countries: readonly Country[] = [createCountry('Fresh Japan')];

      obsolete.cancel();
      await expect(obsoleteResult).rejects.toMatchObject({
        name: 'AbortError',
      });

      search.mockReturnValueOnce(freshResponse.promise);
      const freshResult: Promise<readonly Country[]> = cache.search(
        'Japan',
        createSearchCancellationSource().signal,
      );

      if (completion === 'success') {
        obsoleteResponse.resolve([createCountry('Stale Japan')]);
      } else {
        obsoleteResponse.reject(new Error('Late failure'));
      }

      await new Promise<void>((resolve: () => void): void => {
        setImmediate(resolve);
      });

      const joiningResult: Promise<readonly Country[]> = cache.search(
        'Japan',
        createSearchCancellationSource().signal,
      );

      expect(search).toHaveBeenCalledTimes(2);
      freshResponse.resolve(countries);
      await expect(freshResult).resolves.toEqual(countries);
      await expect(joiningResult).resolves.toEqual(countries);
      await expect(
        cache.search('Japan', createSearchCancellationSource().signal),
      ).resolves.toEqual(countries);

      expect(search).toHaveBeenCalledTimes(2);
    },
  );

  it.each([false, true])(
    'releases caller subscriptions after failure: %s',
    async (shouldFail: boolean): Promise<void> => {
      const { cache, response }: ReturnType<typeof createSharedSearch> =
        createSharedSearch();
      const unsubscribe: Mock<() => void> = vi.fn();
      const signal: SearchCancellationSignal = {
        isCancelled: false,
        onCancel: vi
          .fn<SearchCancellationSignal['onCancel']>()
          .mockReturnValue(unsubscribe),
      };
      const outcome: Promise<PromiseSettledResult<readonly Country[]>[]> =
        Promise.allSettled([cache.search('Japan', signal)]);

      if (shouldFail) {
        response.reject(new HttpError(503));
      } else {
        response.resolve([]);
      }

      await outcome;

      expect(unsubscribe).toHaveBeenCalledTimes(1);
    },
  );

  it('rejects a cancelled caller even when a completed result is cached', async (): Promise<void> => {
    const { cache, response, search }: ReturnType<typeof createSharedSearch> =
      createSharedSearch();
    const cancelled: SearchCancellationSource =
      createSearchCancellationSource();

    response.resolve([]);
    await cache.search('Japan', createSearchCancellationSource().signal);
    cancelled.cancel();

    await expect(cache.search('Japan', cancelled.signal)).rejects.toMatchObject(
      { name: 'AbortError' },
    );

    expect(search).toHaveBeenCalledTimes(1);
  });

  it('keeps cancellation independent for different query keys', async (): Promise<void> => {
    const {
      cache,
      search,
      response: japanResponse,
    }: ReturnType<typeof createSharedSearch> = createSharedSearch();
    const japan: SearchCancellationSource = createSearchCancellationSource();
    const canadaResponse: Deferred<readonly Country[]> = createDeferred();
    const japanResult: Promise<readonly Country[]> = cache.search(
      'Japan',
      japan.signal,
    );

    search.mockReturnValueOnce(canadaResponse.promise);
    const canadaResult: Promise<readonly Country[]> = cache.search(
      'Canada',
      createSearchCancellationSource().signal,
    );

    japan.cancel();
    await expect(japanResult).rejects.toMatchObject({ name: 'AbortError' });
    expect(search.mock.calls[1]?.[1].isCancelled).toBe(false);
    canadaResponse.resolve([createCountry('Canada')]);
    await expect(canadaResult).resolves.toEqual([createCountry('Canada')]);
    japanResponse.resolve([]);
    expect(search).toHaveBeenCalledTimes(2);
  });
});
