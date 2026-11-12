import type { SearchHistoryService } from '@/services/search-history/index';

import type { SearchHistoryReader } from '../application/list-recent-searches.use-case';

// TODO: Replace this adapter if the history storage provider changes.
export function createRecentSearchesAdapter(
  history: SearchHistoryService,
): SearchHistoryReader {
  return {
    getRecentQueries(): string[] {
      return history.getRecentQueries();
    },

    subscribe(listener: () => void): () => void {
      return history.subscribe(listener);
    },
  };
}
