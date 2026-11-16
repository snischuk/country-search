import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Mock } from 'vitest';

import { createSearchCancellationSource as createCancellationSource } from '@/features/country-search/application/search-cancellation';
import {
  HttpError,
  ValidationError,
} from '@/features/country-search/application/search-errors';
import type {
  SearchCancellationSource,
  SearchPort,
} from '@/features/country-search/application/search.port';
import type { Country } from '@/features/country-search/domain/country.type';
import { createCachedSearchPort } from '@/features/country-search/infrastructure/cached-search.adapter';

import { createCountry } from '../../../support/country';
import { createDeferred } from '../../../support/deferred';
import type { Deferred } from '../../../support/deferred';

interface CacheHarness {
  readonly cache: SearchPort;
  readonly transport: SearchPort;
  readonly searchMock: Mock<SearchPort['search']>;
}

function createCacheHarness(): CacheHarness {
  const searchMock: Mock<SearchPort['search']> = vi.fn<SearchPort['search']>();
  const transport: SearchPort = { search: searchMock };

  return { cache: createCachedSearchPort(transport), transport, searchMock };
}

afterEach((): void => {
  vi.useRealTimers();
});

describe('completed country query cache', (): void => {
  it('reuses a successful result for a later caller', async (): Promise<void> => {
    const { cache, searchMock }: CacheHarness = createCacheHarness();
    const countries: readonly Country[] = [createCountry('Japan')];

    searchMock.mockResolvedValue(countries);

    await expect(
      cache.search('Japan', createCancellationSource().signal),
    ).resolves.toEqual(countries);

    await expect(
      cache.search('Japan', createCancellationSource().signal),
    ).resolves.toEqual(countries);

    expect(searchMock).toHaveBeenCalledTimes(1);
  });

  it('caches an empty successful result as well as country matches', async (): Promise<void> => {
    const { cache, searchMock }: CacheHarness = createCacheHarness();

    searchMock.mockResolvedValue([]);

    await expect(
      cache.search('missing', createCancellationSource().signal),
    ).resolves.toEqual([]);

    await expect(
      cache.search('missing', createCancellationSource().signal),
    ).resolves.toEqual([]);

    expect(searchMock).toHaveBeenCalledTimes(1);
  });

  it('trims outer whitespace for both the key and the transport query', async (): Promise<void> => {
    const { cache, searchMock }: CacheHarness = createCacheHarness();

    searchMock.mockResolvedValue([createCountry('Japan')]);

    await cache.search('  Japan  ', createCancellationSource().signal);
    await cache.search('Japan', createCancellationSource().signal);

    expect(searchMock).toHaveBeenCalledTimes(1);
    expect(searchMock.mock.calls[0]?.[0]).toBe('Japan');
  });

  it.each([
    { firstQuery: 'Japan', secondQuery: 'japan' },
    { firstQuery: 'New Zealand', secondQuery: 'New  Zealand' },
    { firstQuery: 'Japan', secondQuery: 'Canada' },
  ])(
    'isolates keys $firstQuery and $secondQuery',
    async ({
      firstQuery,
      secondQuery,
    }: {
      firstQuery: string;
      secondQuery: string;
    }): Promise<void> => {
      const { cache, searchMock }: CacheHarness = createCacheHarness();
      const firstCountries: readonly Country[] = [
        createCountry('First result'),
      ];
      const secondCountries: readonly Country[] = [
        createCountry('Second result'),
      ];

      searchMock
        .mockResolvedValueOnce(firstCountries)
        .mockResolvedValueOnce(secondCountries);

      await expect(
        cache.search(firstQuery, createCancellationSource().signal),
      ).resolves.toEqual(firstCountries);

      await expect(
        cache.search(secondQuery, createCancellationSource().signal),
      ).resolves.toEqual(secondCountries);

      await expect(
        cache.search(firstQuery, createCancellationSource().signal),
      ).resolves.toEqual(firstCountries);

      await expect(
        cache.search(secondQuery, createCancellationSource().signal),
      ).resolves.toEqual(secondCountries);

      expect(searchMock).toHaveBeenCalledTimes(2);
      expect(searchMock.mock.calls[1]?.[0]).toBe(secondQuery);
    },
  );

  it('retains completed results without a TTL or background expiry timer', async (): Promise<void> => {
    vi.useFakeTimers();
    const { cache, searchMock }: CacheHarness = createCacheHarness();
    const countries: readonly Country[] = [createCountry('Japan')];

    searchMock.mockResolvedValue(countries);

    await cache.search('Japan', createCancellationSource().signal);
    await vi.advanceTimersByTimeAsync(86400000);

    await expect(
      cache.search('Japan', createCancellationSource().signal),
    ).resolves.toEqual(countries);

    expect(searchMock).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('keeps stored results local to the adapter instance', async (): Promise<void> => {
    const { cache, transport, searchMock }: CacheHarness = createCacheHarness();

    searchMock.mockResolvedValue([createCountry('Japan')]);

    await cache.search('Japan', createCancellationSource().signal);
    const freshCache: SearchPort = createCachedSearchPort(transport);

    await freshCache.search('Japan', createCancellationSource().signal);

    expect(searchMock).toHaveBeenCalledTimes(2);
  });

  it.each([
    new HttpError(503),
    new ValidationError(),
    new TypeError('Failed to fetch'),
    { name: 'TimeoutError' },
    { name: 'AbortError' },
  ])(
    'allows a fresh attempt after a rejected search: %j',
    async (failure: unknown): Promise<void> => {
      const { cache, searchMock }: CacheHarness = createCacheHarness();
      const countries: readonly Country[] = [createCountry('Japan')];

      searchMock.mockRejectedValueOnce(failure).mockResolvedValue(countries);

      await expect(
        cache.search('Japan', createCancellationSource().signal),
      ).rejects.toBe(failure);

      await expect(
        cache.search('Japan', createCancellationSource().signal),
      ).resolves.toEqual(countries);

      await expect(
        cache.search('Japan', createCancellationSource().signal),
      ).resolves.toEqual(countries);

      expect(searchMock).toHaveBeenCalledTimes(2);
    },
  );

  it('does not cache a late success after the caller has cancelled', async (): Promise<void> => {
    const { cache, searchMock }: CacheHarness = createCacheHarness();
    const countries: readonly Country[] = [createCountry('Japan')];
    const pending: Deferred<readonly Country[]> = createDeferred();

    searchMock
      .mockReturnValueOnce(pending.promise)
      .mockResolvedValue(countries);

    const cancellation: SearchCancellationSource = createCancellationSource();
    const cancelledSearch: Promise<readonly Country[]> = cache.search(
      'Japan',
      cancellation.signal,
    );

    cancellation.cancel();
    pending.resolve(countries);

    await expect(cancelledSearch).rejects.toMatchObject({ name: 'AbortError' });
    await expect(
      cache.search('Japan', createCancellationSource().signal),
    ).resolves.toEqual(countries);

    expect(searchMock).toHaveBeenCalledTimes(2);
  });
});
