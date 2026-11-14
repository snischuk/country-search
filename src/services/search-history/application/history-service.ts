import type { HistoryStorage } from './history-storage.port';

export interface HistoryService {
  getRecentQueries(): readonly string[];
  recordQuery(query: string): void;
  subscribe(onHistoryChange: (queries: readonly string[]) => void): () => void;
}

export function createHistoryService(storage: HistoryStorage): HistoryService {
  throw new Error('Not implemented', { cause: storage });
}
