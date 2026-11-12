import { describe, expect, it, vi } from 'vitest';

import {
  createLocalStorageHistoryStorage,
  createSearchHistoryService,
} from '@/services/search-history/index';
import type {
  SearchHistoryService,
  SearchHistoryStorage,
} from '@/services/search-history/index';

describe('search history boundaries', (): void => {
  it('applies history rules with an injected in-memory storage and no browser', (): void => {
    let savedQueries: string[] = [];
    const storage: SearchHistoryStorage = {
      load: (): string[] => [...savedQueries],
      save: (queries: readonly string[]): void => {
        savedQueries = [...queries];
      },
    };
    const history: SearchHistoryService = createSearchHistoryService(storage);

    [
      'Japan',
      'Spain',
      'Italy',
      'France',
      'Canada',
      'Brazil',
      ' japan ',
    ].forEach((query: string): void => history.recordQuery(query));
    history.recordQuery('  ');

    expect(history.getRecentQueries()).toEqual([
      'japan',
      'Brazil',
      'Canada',
      'France',
      'Italy',
    ]);
    expect(createSearchHistoryService(storage).getRecentQueries()).toEqual(
      history.getRecentQueries(),
    );
  });

  it('notifies subscribers and protects state from returned-array mutations', (): void => {
    const history: SearchHistoryService = createSearchHistoryService({
      load: (): string[] => [],
      save: (): void => {},
    });
    const listener: () => void = vi.fn();
    const unsubscribe: () => void = history.subscribe(listener);

    history.recordQuery('Japan');
    history.getRecentQueries().push('unexpected mutation');
    unsubscribe();
    history.recordQuery('Spain');

    expect(listener).toHaveBeenCalledTimes(1);
    expect(history.getRecentQueries()).toEqual(['Spain', 'Japan']);
  });

  it('keeps working in memory when the localStorage adapter cannot persist', (): void => {
    vi.stubGlobal('localStorage', {
      getItem: (): string => '{invalid JSON',
      setItem: (): never => {
        throw new Error('Storage is unavailable');
      },
    });
    const history: SearchHistoryService = createSearchHistoryService(
      createLocalStorageHistoryStorage(),
    );

    expect(history.getRecentQueries()).toEqual([]);
    expect((): void => history.recordQuery('Japan')).not.toThrow();
    expect(history.getRecentQueries()).toEqual(['Japan']);
  });
});
