import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Mock } from 'vitest';

import {
  SEARCH_STATUS,
  createCachedSearchPort,
  createSearchCountriesAdapter,
} from '@/features/country-search';
import type { SearchPort } from '@/features/country-search';
import { createHistoryService } from '@/services/search-history/application/history-service';
import { createLocalStorageHistoryAdapter } from '@/services/search-history/infrastructure/local-storage-history.adapter';
import type { KeyValueStorage } from '@/shared/application/storage/key-value-storage.port';

import { createControllerSetup } from '../support/search-controller';
import { createMemoryStorage } from '../support/storage';

function createHistory(): ReturnType<typeof createHistoryService> {
  return createHistoryService(
    createLocalStorageHistoryAdapter(createMemoryStorage()),
  );
}

beforeEach((): void => {
  vi.useFakeTimers();
});

afterEach((): void => {
  vi.clearAllTimers();
  vi.useRealTimers();
});

describe('search and history integration', (): void => {
  it('restores launched searches when the history service is recreated', async (): Promise<void> => {
    const storage: KeyValueStorage = createMemoryStorage();
    const history: ReturnType<typeof createHistoryService> =
      createHistoryService(createLocalStorageHistoryAdapter(storage));
    const { controller }: ReturnType<typeof createControllerSetup> =
      createControllerSetup(history);

    controller.searchFromHistory(' Japan ');
    await vi.advanceTimersByTimeAsync(0);
    const restored: ReturnType<typeof createHistoryService> =
      createHistoryService(createLocalStorageHistoryAdapter(storage));

    expect(restored.getRecentQueries()).toEqual(['Japan']);
  });

  it('records only the latest query when debounce actually launches it', async (): Promise<void> => {
    const history: ReturnType<typeof createHistoryService> = createHistory();
    const { controller, search }: ReturnType<typeof createControllerSetup> =
      createControllerSetup(history);

    controller.updateSearchQuery('Japan');
    controller.updateSearchQuery('Canada');
    expect(history.getRecentQueries()).toEqual([]);
    await vi.advanceTimersByTimeAsync(300);

    expect(history.getRecentQueries()).toEqual(['Canada']);
    expect(search).toHaveBeenCalledExactlyOnceWith('Canada', expect.anything());
  });

  it.each([false, true])(
    'records a launched query even when it fails: %s',
    async (shouldFail: boolean): Promise<void> => {
      const history: ReturnType<typeof createHistoryService> = createHistory();
      const {
        controller,
        search,
        render,
      }: ReturnType<typeof createControllerSetup> =
        createControllerSetup(history);

      if (shouldFail) {
        search.mockRejectedValue(new TypeError('Offline'));
      }

      controller.searchFromHistory('Japan');
      await vi.advanceTimersByTimeAsync(0);

      expect(history.getRecentQueries()).toEqual(['Japan']);
      expect(render).toHaveBeenLastCalledWith(
        expect.objectContaining({
          status: shouldFail ? SEARCH_STATUS.error : SEARCH_STATUS.empty,
          query: 'Japan',
        }),
        null,
      );
    },
  );

  it('moves a cached history selection to the front without another HTTP request', async (): Promise<void> => {
    const history: ReturnType<typeof createHistoryService> = createHistory();
    const cache: SearchPort = createCachedSearchPort(
      createSearchCountriesAdapter(),
    );
    const fetchRequest: Mock<typeof fetch> = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('not JSON', { status: 404 }));
    const { controller, render }: ReturnType<typeof createControllerSetup> =
      createControllerSetup(history, cache);

    controller.searchFromHistory('missing');
    await vi.advanceTimersByTimeAsync(0);
    controller.searchFromHistory('Japan');
    await vi.advanceTimersByTimeAsync(0);
    controller.searchFromHistory(' missing ');
    await vi.advanceTimersByTimeAsync(0);

    expect(fetchRequest).toHaveBeenCalledTimes(2);
    expect(history.getRecentQueries()).toEqual(['missing', 'Japan']);
    expect(render).toHaveBeenLastCalledWith(
      { status: SEARCH_STATUS.empty, query: 'missing' },
      null,
    );
  });

  it('updates the search field and launches a history selection immediately', async (): Promise<void> => {
    const history: ReturnType<typeof createHistoryService> = createHistory();
    const {
      controller,
      setQuery,
      search,
    }: ReturnType<typeof createControllerSetup> =
      createControllerSetup(history);

    controller.searchFromHistory(' Japan ');

    expect(setQuery).toHaveBeenCalledExactlyOnceWith('Japan');
    expect(search).toHaveBeenCalledExactlyOnceWith('Japan', expect.anything());
    await vi.advanceTimersByTimeAsync(300);
    expect(search).toHaveBeenCalledTimes(1);
    expect(history.getRecentQueries()).toEqual(['Japan']);
  });

  it('does not record a query cleared before debounce completes', async (): Promise<void> => {
    const history: ReturnType<typeof createHistoryService> = createHistory();
    const { controller, search }: ReturnType<typeof createControllerSetup> =
      createControllerSetup(history);

    controller.updateSearchQuery('Japan');
    controller.updateSearchQuery('');
    await vi.runAllTimersAsync();

    expect(history.getRecentQueries()).toEqual([]);
    expect(search).not.toHaveBeenCalled();
  });

  it('keeps a launched query in history after a later input cancels it', async (): Promise<void> => {
    const history: ReturnType<typeof createHistoryService> = createHistory();
    const { controller, search }: ReturnType<typeof createControllerSetup> =
      createControllerSetup(history);

    controller.searchFromHistory('Japan');
    controller.updateSearchQuery('Canada');

    expect(search.mock.calls[0]?.[1].isCancelled).toBe(true);
    expect(history.getRecentQueries()).toEqual(['Japan']);
    await vi.advanceTimersByTimeAsync(300);
    expect(history.getRecentQueries()).toEqual(['Canada', 'Japan']);
  });
});
