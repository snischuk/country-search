import type { SearchQuery } from '../domain/search-query.type';

export interface SearchHistoryReader {
  getRecentQueries(): SearchQuery[];
  subscribe(listener: () => void): () => void;
}

export type ListRecentSearchesUseCase = () => SearchQuery[];

// TODO: Add history-specific application rules here when they are needed.
export function createListRecentSearchesUseCase(
  historyReader: SearchHistoryReader,
): ListRecentSearchesUseCase {
  return (): SearchQuery[] => historyReader.getRecentQueries();
}
