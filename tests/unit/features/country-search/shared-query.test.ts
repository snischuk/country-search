import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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

const REQUEST_TIMEOUT_MS: number = 10_000;

interface TrackedCancellation extends SearchCancellationSource {
  getSubscriberCount(): number;
}

interface RecordedRequest {
  readonly query: string;
  readonly signal: SearchCancellationSignal;
  cancellationCount: number;
  resolve(countries: readonly Country[]): void;
  reject(error: Error): void;
}

interface SharedSearchHarness {
  readonly cache: SearchPort;
  readonly requests: RecordedRequest[];
}

interface SearchObservation {
  status: 'pending' | 'fulfilled' | 'rejected';
  countries: readonly Country[] | null;
  error: unknown;
}

const activeHarnesses: SharedSearchHarness[] = [];

function createCountry(name: string): Country {
  return {
    id: name,
    name,
    flagUrl: null,
    flagEmoji: null,
    capital: null,
    region: null,
    population: null,
    area: null,
    languages: [],
    currencies: [],
    borders: [],
    description: name,
  };
}

function createCancellationSource(): TrackedCancellation {
  let isCancelled: boolean = false;
  const callbacks: Set<() => void> = new Set();
  const signal: SearchCancellationSignal = {
    get isCancelled(): boolean {
      return isCancelled;
    },
    onCancel(callback: () => void): () => void {
      if (isCancelled) {
        callback();

        return (): void => {};
      }

      callbacks.add(callback);

      return (): void => {
        callbacks.delete(callback);
      };
    },
  };

  return {
    signal,
    cancel(): void {
      if (isCancelled) {
        return;
      }

      isCancelled = true;
      callbacks.forEach((callback: () => void): void => {
        callback();
      });

      callbacks.clear();
    },
    getSubscriberCount(): number {
      return callbacks.size;
    },
  };
}

function observeSearch(
  promise: Promise<readonly Country[]>,
): SearchObservation {
  const observation: SearchObservation = {
    status: 'pending',
    countries: null,
    error: null,
  };

  void promise.then(
    (countries: readonly Country[]): void => {
      observation.status = 'fulfilled';
      observation.countries = countries;
    },
    (error: unknown): void => {
      observation.status = 'rejected';
      observation.error = error;
    },
  );

  return observation;
}

function createSharedSearchHarness(
  shouldHonorCancellation: boolean = true,
): SharedSearchHarness {
  const requests: RecordedRequest[] = [];
  const transport: SearchPort = {
    search(
      query: string,
      signal: SearchCancellationSignal,
    ): Promise<readonly Country[]> {
      return new Promise<readonly Country[]>(
        (
          resolve: (countries: readonly Country[]) => void,
          reject: (error: Error) => void,
        ): void => {
          let removeCancellationCallback = (): void => {};

          const deadlineTimer: ReturnType<typeof setTimeout> = setTimeout(
            (): void => {
              request.reject(
                new DOMException('The operation timed out.', 'TimeoutError'),
              );
            },
            REQUEST_TIMEOUT_MS,
          );
          const request: RecordedRequest = {
            query,
            signal,
            cancellationCount: 0,
            resolve(countries: readonly Country[]): void {
              clearTimeout(deadlineTimer);
              removeCancellationCallback();
              resolve(countries);
            },
            reject(error: Error): void {
              clearTimeout(deadlineTimer);
              removeCancellationCallback();
              reject(error);
            },
          };

          requests.push(request);
          removeCancellationCallback = signal.onCancel((): void => {
            request.cancellationCount++;
            if (shouldHonorCancellation) {
              request.reject(
                new DOMException('The request was cancelled.', 'AbortError'),
              );
            }
          });
        },
      );
    },
  };
  const harness: SharedSearchHarness = {
    cache: createCachedSearchPort(transport),
    requests,
  };

  activeHarnesses.push(harness);

  return harness;
}

async function resolvePendingWork(): Promise<void> {
  await vi.advanceTimersByTimeAsync(0);
}

beforeEach((): void => {
  vi.useFakeTimers();
});

afterEach(async (): Promise<void> => {
  activeHarnesses.splice(0).forEach((harness: SharedSearchHarness): void => {
    harness.requests.forEach((request: RecordedRequest): void => {
      request.resolve([]);
    });
  });

  await resolvePendingWork();
  vi.useRealTimers();
});

describe('shared in-flight country searches', (): void => {
  it('uses one normalized transport and independent promises for two callers', async (): Promise<void> => {
    const { cache, requests }: SharedSearchHarness =
      createSharedSearchHarness();
    const first: TrackedCancellation = createCancellationSource();
    const second: TrackedCancellation = createCancellationSource();
    const countries: readonly Country[] = [createCountry('Japan')];
    const firstPromise: Promise<readonly Country[]> = cache.search(
      ' Japan ',
      first.signal,
    );
    const secondPromise: Promise<readonly Country[]> = cache.search(
      'Japan',
      second.signal,
    );
    const firstResult: SearchObservation = observeSearch(firstPromise);
    const secondResult: SearchObservation = observeSearch(secondPromise);

    expect(firstPromise).not.toBe(secondPromise);
    expect(requests).toHaveLength(1);
    expect(requests[0]?.query).toBe('Japan');
    requests[0]?.resolve(countries);
    await resolvePendingWork();

    expect(firstResult.countries).toEqual(countries);
    expect(secondResult.countries).toEqual(countries);
    expect(first.getSubscriberCount()).toBe(0);
    expect(second.getSubscriberCount()).toBe(0);
    first.cancel();
    second.cancel();
    expect(requests[0]?.cancellationCount).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('does not attach an already cancelled caller to active work', async (): Promise<void> => {
    const { cache, requests }: SharedSearchHarness =
      createSharedSearchHarness();
    const active: TrackedCancellation = createCancellationSource();
    const cancelled: TrackedCancellation = createCancellationSource();
    const activeResult: SearchObservation = observeSearch(
      cache.search('Japan', active.signal),
    );

    cancelled.cancel();
    const cancelledResult: SearchObservation = observeSearch(
      cache.search('Japan', cancelled.signal),
    );

    await resolvePendingWork();

    expect(cancelledResult.status).toBe('rejected');
    expect(cancelledResult.error).toMatchObject({ name: 'AbortError' });
    expect(requests).toHaveLength(1);
    expect(requests[0]?.signal.isCancelled).toBe(false);
    requests[0]?.resolve([]);
    await resolvePendingWork();
    expect(activeResult.status).toBe('fulfilled');
  });

  it('rejects only the cancelled caller while the other keeps the shared transport', async (): Promise<void> => {
    const { cache, requests }: SharedSearchHarness =
      createSharedSearchHarness();
    const first: TrackedCancellation = createCancellationSource();
    const second: TrackedCancellation = createCancellationSource();
    const firstResult: SearchObservation = observeSearch(
      cache.search('Japan', first.signal),
    );
    const secondResult: SearchObservation = observeSearch(
      cache.search('Japan', second.signal),
    );

    first.cancel();
    await resolvePendingWork();

    expect(firstResult.status).toBe('rejected');
    expect(firstResult.error).toMatchObject({ name: 'AbortError' });
    expect(secondResult.status).toBe('pending');
    expect(requests[0]?.signal.isCancelled).toBe(false);
    expect(requests[0]?.cancellationCount).toBe(0);
    requests[0]?.resolve([createCountry('Japan')]);
    await resolvePendingWork();
    expect(secondResult.status).toBe('fulfilled');
    expect(second.getSubscriberCount()).toBe(0);
  });

  it('aborts after the last detach and permits an immediate same-key restart', async (): Promise<void> => {
    const { cache, requests }: SharedSearchHarness =
      createSharedSearchHarness();
    const first: TrackedCancellation = createCancellationSource();
    const second: TrackedCancellation = createCancellationSource();
    const firstResult: SearchObservation = observeSearch(
      cache.search('Japan', first.signal),
    );
    const secondResult: SearchObservation = observeSearch(
      cache.search('Japan', second.signal),
    );

    first.cancel();
    second.cancel();
    expect(requests[0]?.signal.isCancelled).toBe(true);
    expect(requests[0]?.cancellationCount).toBe(1);
    const restartedResult: SearchObservation = observeSearch(
      cache.search('Japan', createCancellationSource().signal),
    );

    expect(requests).toHaveLength(2);
    expect(requests[1]?.signal.isCancelled).toBe(false);
    requests[1]?.resolve([createCountry('Japan')]);
    await resolvePendingWork();
    expect(firstResult.status).toBe('rejected');
    expect(secondResult.status).toBe('rejected');
    expect(restartedResult.status).toBe('fulfilled');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('fans out a timeout to all callers and allows retry', async (): Promise<void> => {
    const { cache, requests }: SharedSearchHarness =
      createSharedSearchHarness();
    const first: TrackedCancellation = createCancellationSource();
    const second: TrackedCancellation = createCancellationSource();
    const firstResult: SearchObservation = observeSearch(
      cache.search('Japan', first.signal),
    );
    const secondResult: SearchObservation = observeSearch(
      cache.search('Japan', second.signal),
    );

    await vi.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS);

    expect(firstResult.error).toMatchObject({ name: 'TimeoutError' });
    expect(secondResult.error).toBe(firstResult.error);
    expect(first.getSubscriberCount()).toBe(0);
    expect(second.getSubscriberCount()).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
    const retriedResult: SearchObservation = observeSearch(
      cache.search('Japan', createCancellationSource().signal),
    );

    expect(requests).toHaveLength(2);
    requests[1]?.resolve([]);
    await resolvePendingWork();
    expect(retriedResult.status).toBe('fulfilled');
  });

  it.each([
    new HttpError(503),
    new ValidationError(),
    new TypeError('Failed to fetch'),
  ])(
    'shares a failure and starts a fresh retry: %j',
    async (error: Error): Promise<void> => {
      const { cache, requests }: SharedSearchHarness =
        createSharedSearchHarness();
      const first: TrackedCancellation = createCancellationSource();
      const second: TrackedCancellation = createCancellationSource();
      const firstResult: SearchObservation = observeSearch(
        cache.search('Japan', first.signal),
      );
      const secondResult: SearchObservation = observeSearch(
        cache.search('Japan', second.signal),
      );

      requests[0]?.reject(error);
      await resolvePendingWork();

      expect(firstResult.error).toBe(error);
      expect(secondResult.status).toBe('rejected');
      expect(secondResult.error).toBe(error);
      expect(first.getSubscriberCount()).toBe(0);
      expect(second.getSubscriberCount()).toBe(0);
      const retriedResult: SearchObservation = observeSearch(
        cache.search('Japan', createCancellationSource().signal),
      );

      expect(requests).toHaveLength(2);
      requests[1]?.resolve([]);
      await resolvePendingWork();
      expect(retriedResult.status).toBe('fulfilled');
      expect(vi.getTimerCount()).toBe(0);
    },
  );

  it.each([false, true])(
    'preserves replacement after obsolete completion (success: %s)',
    async (shouldResolveStale: boolean): Promise<void> => {
      const { cache, requests }: SharedSearchHarness =
        createSharedSearchHarness(false);
      const obsolete: TrackedCancellation = createCancellationSource();
      const obsoleteResult: SearchObservation = observeSearch(
        cache.search('Japan', obsolete.signal),
      );

      obsolete.cancel();
      await resolvePendingWork();
      expect(obsoleteResult.status).toBe('rejected');
      const fresh: TrackedCancellation = createCancellationSource();
      const freshResult: SearchObservation = observeSearch(
        cache.search('Japan', fresh.signal),
      );

      expect(requests).toHaveLength(2);

      if (shouldResolveStale) {
        requests[0]?.resolve([createCountry('Stale result')]);
      } else {
        requests[0]?.reject(new Error('Late failure'));
      }

      await resolvePendingWork();
      const joiningResult: SearchObservation = observeSearch(
        cache.search('Japan', createCancellationSource().signal),
      );

      expect(requests).toHaveLength(2);
      expect(joiningResult.status).toBe('pending');
      const freshCountries: readonly Country[] = [
        createCountry('Fresh result'),
      ];

      requests[1]?.resolve(freshCountries);
      await resolvePendingWork();
      expect(freshResult.countries).toEqual(freshCountries);
      expect(joiningResult.countries).toEqual(freshCountries);
      const cachedResult: SearchObservation = observeSearch(
        cache.search('Japan', createCancellationSource().signal),
      );

      await resolvePendingWork();
      expect(cachedResult.countries).toEqual(freshCountries);
      expect(requests).toHaveLength(2);
    },
  );

  it('rejects a cancelled caller even when a completed result exists', async (): Promise<void> => {
    const { cache, requests }: SharedSearchHarness =
      createSharedSearchHarness();
    const firstResult: SearchObservation = observeSearch(
      cache.search('Japan', createCancellationSource().signal),
    );

    requests[0]?.resolve([]);
    await resolvePendingWork();
    expect(firstResult.status).toBe('fulfilled');
    const cancelled: TrackedCancellation = createCancellationSource();

    cancelled.cancel();
    const cancelledResult: SearchObservation = observeSearch(
      cache.search('Japan', cancelled.signal),
    );

    await resolvePendingWork();
    expect(cancelledResult.error).toMatchObject({ name: 'AbortError' });
    expect(requests).toHaveLength(1);
    expect(cancelled.getSubscriberCount()).toBe(0);
  });

  it('keeps different query transports and cancellation independent', async (): Promise<void> => {
    const { cache, requests }: SharedSearchHarness =
      createSharedSearchHarness();
    const japan: TrackedCancellation = createCancellationSource();
    const canada: TrackedCancellation = createCancellationSource();
    const japanResult: SearchObservation = observeSearch(
      cache.search('Japan', japan.signal),
    );
    const canadaResult: SearchObservation = observeSearch(
      cache.search('Canada', canada.signal),
    );

    expect(requests).toHaveLength(2);
    japan.cancel();
    expect(requests[1]?.signal.isCancelled).toBe(false);
    requests[1]?.resolve([createCountry('Canada')]);
    await resolvePendingWork();
    expect(japanResult.status).toBe('rejected');
    expect(canadaResult.status).toBe('fulfilled');
    expect(japan.getSubscriberCount()).toBe(0);
    expect(canada.getSubscriberCount()).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });
});
