import type { HistoryStorage } from '@/services/search-history/application/history-storage.port';
import {
  addHistoryQuery,
  getNormalizedHistory,
} from '@/services/search-history/domain/history';

export interface HistoryService {
  getRecentQueries(): readonly string[];
  recordQuery(query: string): void;
  subscribe(onHistoryChange: (queries: readonly string[]) => void): () => void;
}

export function createHistoryService(storage: HistoryStorage): HistoryService {
  let recentQueries: readonly string[] = [];
  const subscribers: Set<(queries: readonly string[]) => void> = new Set();

  try {
    recentQueries = getNormalizedHistory(storage.load());
  } catch {
    recentQueries = [];
  }

  function getRecentQueries(): readonly string[] {
    return recentQueries;
  }

  function recordQuery(query: string): void {
    const updatedQueries: readonly string[] = addHistoryQuery(
      recentQueries,
      query,
    );

    if (updatedQueries === recentQueries) {
      return;
    }

    recentQueries = updatedQueries;

    try {
      storage.save(recentQueries);
    } catch {
      recentQueries = updatedQueries;
    }

    subscribers.forEach(
      (onHistoryChange: (queries: readonly string[]) => void): void => {
        onHistoryChange(recentQueries);
      },
    );
  }

  function subscribe(
    onHistoryChange: (queries: readonly string[]) => void,
  ): () => void {
    subscribers.add(onHistoryChange);

    return (): void => {
      subscribers.delete(onHistoryChange);
    };
  }

  return { getRecentQueries, recordQuery, subscribe };
}
