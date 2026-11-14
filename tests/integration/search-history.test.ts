import { describe, expect, it, vi } from 'vitest';
import type { Mock } from 'vitest';

import {
  SEARCH_STATUS,
  createCachedSearchPort,
  createSearchController,
} from '@/features/country-search';
import type {
  HistoryRecorder,
  SearchPort,
  SearchState,
  SearchView,
} from '@/features/country-search';

interface ScheduledSearch {
  readonly callback: () => void;
  isCancelled: boolean;
}

function createSearchHistorySetup(useCache: boolean = false): {
  readonly controller: ReturnType<typeof createSearchController>;
  readonly search: Mock<SearchPort['search']>;
  readonly recordQuery: ReturnType<typeof vi.fn>;
  readonly scheduledSearches: ScheduledSearch[];
  readonly states: SearchState[];
  readonly searchField: { value: string };
} {
  const states: SearchState[] = [];
  const searchField: { value: string } = { value: '' };
  const scheduledSearches: ScheduledSearch[] = [];
  const search: Mock<SearchPort['search']> = vi.fn<SearchPort['search']>();

  search.mockResolvedValue([]);
  const recordQuery: ReturnType<typeof vi.fn<(query: string) => void>> =
    vi.fn<(query: string) => void>();
  const transport: SearchPort = { search };
  const searchPort: SearchPort = useCache
    ? createCachedSearchPort(transport)
    : transport;
  const historyRecorder: HistoryRecorder = { recordQuery };
  const searchView: SearchView = {
    render(state: SearchState): void {
      states.push(state);
    },
    setQuery(query: string): void {
      searchField.value = query;
    },
  };
  const controller: ReturnType<typeof createSearchController> =
    createSearchController(
      searchPort,
      searchView,
      (callback: () => void): { invoke(): void; cancel(): void } => {
        const scheduledSearch: ScheduledSearch = {
          callback,
          isCancelled: false,
        };

        scheduledSearches.push(scheduledSearch);

        return {
          invoke(): void {
            if (!scheduledSearch.isCancelled) {
              callback();
            }
          },
          cancel(): void {
            scheduledSearch.isCancelled = true;
          },
        };
      },
      historyRecorder,
    );

  return {
    controller,
    search,
    recordQuery,
    scheduledSearches,
    states,
    searchField,
  };
}

describe('search history integration', (): void => {
  it('records only when the debounced search actually starts', async (): Promise<void> => {
    const setup: ReturnType<typeof createSearchHistorySetup> =
      createSearchHistorySetup();

    setup.controller.updateSearchQuery('Japan');
    setup.controller.updateSearchQuery('Canada');

    expect(setup.recordQuery).not.toHaveBeenCalled();

    setup.scheduledSearches[1]?.callback();
    await Promise.resolve();

    expect(setup.recordQuery).toHaveBeenCalledExactlyOnceWith('Canada');
    expect(setup.search).toHaveBeenCalledExactlyOnceWith(
      'Canada',
      expect.anything(),
    );

    setup.controller.destroy();
  });

  it('records a launched query even when the search later returns no matches', async (): Promise<void> => {
    const setup: ReturnType<typeof createSearchHistorySetup> =
      createSearchHistorySetup();

    setup.controller.searchFromHistory('missing');
    await Promise.resolve();

    expect(setup.recordQuery).toHaveBeenCalledExactlyOnceWith('missing');
    expect(setup.states.at(-1)).toEqual({
      status: SEARCH_STATUS.empty,
      query: 'missing',
    });

    setup.controller.destroy();
  });

  it('records a launched query even when the search fails', async (): Promise<void> => {
    const setup: ReturnType<typeof createSearchHistorySetup> =
      createSearchHistorySetup();

    setup.search.mockRejectedValueOnce(new TypeError('Network unavailable'));

    setup.controller.searchFromHistory('Japan');
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(setup.recordQuery).toHaveBeenCalledExactlyOnceWith('Japan');

    setup.controller.destroy();
  });

  it('records a search selected from history even when cache avoids transport', async (): Promise<void> => {
    const setup: ReturnType<typeof createSearchHistorySetup> =
      createSearchHistorySetup(true);

    setup.controller.searchFromHistory('Japan');
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    setup.controller.searchFromHistory(' Japan ');
    await Promise.resolve();

    expect(setup.recordQuery.mock.calls).toEqual([['Japan'], ['Japan']]);
    expect(setup.search).toHaveBeenCalledOnce();

    setup.controller.destroy();
  });

  it('updates the search field and launches a selected history query immediately', (): void => {
    const setup: ReturnType<typeof createSearchHistorySetup> =
      createSearchHistorySetup();

    setup.controller.searchFromHistory('  Japan  ');

    expect(setup.searchField.value).toBe('Japan');
    expect(setup.search).toHaveBeenCalledOnce();
    expect(setup.scheduledSearches).toHaveLength(0);

    setup.controller.destroy();
  });

  it('does not record a scheduled search cancelled before launch', (): void => {
    const setup: ReturnType<typeof createSearchHistorySetup> =
      createSearchHistorySetup();

    setup.controller.updateSearchQuery('Japan');
    setup.controller.updateSearchQuery('');

    expect(setup.recordQuery).not.toHaveBeenCalled();
    expect(setup.scheduledSearches[0]?.isCancelled).toBe(true);

    setup.controller.destroy();
  });

  it('records a launched query even if a later query cancels its request', (): void => {
    const setup: ReturnType<typeof createSearchHistorySetup> =
      createSearchHistorySetup();

    setup.controller.searchFromHistory('Japan');
    setup.controller.updateSearchQuery('Canada');

    expect(setup.recordQuery).toHaveBeenCalledExactlyOnceWith('Japan');
    expect(setup.scheduledSearches).toHaveLength(1);

    setup.controller.destroy();
  });
});
