import {
  createBrowserTimerDriver,
  createCountrySearchPage,
  createDebounceSchedulerFactory,
  createSearchController,
  searchCountries,
} from '@/features/country-search';
import type {
  CountrySearchPage,
  SchedulerFactory,
  SearchController,
  SearchPort,
} from '@/features/country-search';

export function startApp(container: HTMLElement): () => void {
  const page: CountrySearchPage = createCountrySearchPage({
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
  });
  const searchPort: SearchPort = { search: searchCountries };
  const schedulerFactory: SchedulerFactory = createDebounceSchedulerFactory(
    createBrowserTimerDriver(),
  );
  const controller: SearchController = createSearchController(
    searchPort,
    page.view,
    schedulerFactory,
  );

  container.append(page.element);

  return (): void => {
    controller.destroy();
    page.element.remove();
  };
}
