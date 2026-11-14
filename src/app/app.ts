import {
  createBrowserTimerDriver,
  createCachedSearchPort,
  createCountrySearchPanel,
  createDebounceSchedulerFactory,
  createSearchController,
  searchCountries,
} from '@/features/country-search';
import type {
  CountrySearchPanel,
  SchedulerFactory,
  SearchController,
  SearchPort,
} from '@/features/country-search';

import { createCountrySearchPage } from './pages/country-search.page';

export function startApp(container: HTMLElement): () => void {
  const searchPanel: CountrySearchPanel = createCountrySearchPanel({
    onQueryChange(rawQuery: string): void {
      controller.updateSearchQuery(rawQuery);
    },
    onSubmit(): void {
      controller.retrySearch();
    },
    onRetry(): void {
      controller.retrySearch();
    },
    onSelectCountry(countryId: string): void {
      controller.selectCountry(countryId);
    },
    onCloseDetails(): void {
      controller.closeCountryDetails();
    },
  });
  const transport: SearchPort = { search: searchCountries };
  const searchPort: SearchPort = createCachedSearchPort(transport);
  const schedulerFactory: SchedulerFactory = createDebounceSchedulerFactory(
    createBrowserTimerDriver(),
  );
  const controller: SearchController = createSearchController(
    searchPort,
    searchPanel.view,
    schedulerFactory,
  );

  const page: HTMLElement = createCountrySearchPage(searchPanel.element);

  container.append(page);

  return (): void => {
    controller.destroy();
    page.remove();
  };
}
