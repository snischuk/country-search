export { createListRecentSearchesUseCase } from './application/list-recent-searches.use-case';
export type {
  ListRecentSearchesUseCase,
  SearchHistoryReader,
} from './application/list-recent-searches.use-case';
export type { SearchQuery } from './domain/search-query.type';
export { createRecentSearchesAdapter } from './infrastructure/search-history.adapter';
export { renderRecentSearches } from './presentation/recent-searches.page';
