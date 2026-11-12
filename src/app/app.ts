import {
  countriesDevelopmentGateway,
  createSearchCountriesUseCase,
  renderCountrySearchPage,
} from '@/features/country-search/index.ts';
import type { SearchCountriesUseCase } from '@/features/country-search/index.ts';
import {
  createListRecentSearchesUseCase,
  createRecentSearchesAdapter,
  renderRecentSearches,
} from '@/features/search-history/index.ts';
import type {
  ListRecentSearchesUseCase,
  SearchHistoryReader,
} from '@/features/search-history/index.ts';
import {
  createLocalStorageHistoryStorage,
  createSearchHistoryService,
} from '@/services/search-history/index';
import type { SearchHistoryService } from '@/services/search-history/index';

// TODO: Add application-wide setup here when the app needs more than one feature.
export function startApp(root: HTMLElement): void {
  const searchHistoryService: SearchHistoryService = createSearchHistoryService(
    createLocalStorageHistoryStorage(),
  );
  const recentSearchesAdapter: SearchHistoryReader =
    createRecentSearchesAdapter(searchHistoryService);
  const searchCountries: SearchCountriesUseCase = createSearchCountriesUseCase(
    countriesDevelopmentGateway,
  );

  const recentSearchesRoot: HTMLDivElement = document.createElement('div');

  renderCountrySearchPage(root, searchCountries, (query: string): void => {
    searchHistoryService.recordQuery(query);
  });

  const listRecentSearches: ListRecentSearchesUseCase =
    createListRecentSearchesUseCase(recentSearchesAdapter);

  renderRecentSearches(
    recentSearchesRoot,
    recentSearchesAdapter,
    listRecentSearches,
  );
  root.append(recentSearchesRoot);
}
