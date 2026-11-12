import {
  normalizeSearchHistory,
  recordSearchQuery,
} from '../domain/search-history';

import type { SearchHistoryStorage } from './search-history-storage';

export type SearchHistoryListener = () => void;

export interface SearchHistoryService {
  recordQuery(query: string): void;
  getRecentQueries(): string[];
  subscribe(listener: SearchHistoryListener): () => void;
}

// TODO: Coordinate history operations here; inject persistence through its port.
export function createSearchHistoryService(
  storage: SearchHistoryStorage,
): SearchHistoryService {
  let recentQueries: string[] = normalizeSearchHistory(storage.load());
  const listeners: Set<SearchHistoryListener> = new Set();

  return {
    recordQuery(query: string): void {
      if (query.trim().length === 0) {
        return;
      }

      recentQueries = recordSearchQuery(recentQueries, query);
      storage.save(recentQueries);
      listeners.forEach((listener: SearchHistoryListener): void => listener());
    },

    getRecentQueries(): string[] {
      return [...recentQueries];
    },

    subscribe(listener: SearchHistoryListener): () => void {
      listeners.add(listener);

      return (): void => {
        listeners.delete(listener);
      };
    },
  };
}
