import type { Country } from '../domain/country.type';
import { SEARCH_STATUS } from '../domain/search-state.type';
import type { SearchState } from '../domain/search-state.type';

import { createSearchCancellationSource } from './search-cancellation';
import { getSearchError } from './search-errors';
import type { ClassifiedSearchError } from './search-errors';
import type {
  HistoryRecorder,
  ScheduledTask,
  SchedulerFactory,
  SearchCancellationSource,
  SearchController,
  SearchPort,
  SearchView,
} from './search.port';

const SEARCH_DEBOUNCE_DELAY_MS: number = 300;

export function createSearchController(
  searchPort: SearchPort,
  searchView: SearchView,
  schedulerFactory: SchedulerFactory,
  historyRecorder?: HistoryRecorder,
): SearchController {
  let currentQuery: string = '';
  let currentState: SearchState = { status: SEARCH_STATUS.idle };
  let currentCountries: readonly Country[] = [];
  let selectedCountry: Country | null = null;
  let currentCancellationSource: SearchCancellationSource | null = null;
  let scheduledTask: ScheduledTask | null = null;

  function renderState(state: SearchState): void {
    currentState = state;
    searchView.render(state, selectedCountry);
  }

  function cancelScheduledSearch(): void {
    scheduledTask?.cancel();
    scheduledTask = null;
  }

  function cancelCurrentSearch(): void {
    currentCancellationSource?.cancel();
    currentCancellationSource = null;
  }

  function destroySearchController(): void {
    cancelScheduledSearch();
    cancelCurrentSearch();
  }

  async function executeCountrySearch(
    query: string,
    cancellationSource: SearchCancellationSource,
  ): Promise<void> {
    if (
      currentCancellationSource !== cancellationSource ||
      cancellationSource.signal.isCancelled
    ) {
      return;
    }

    selectedCountry = null;
    renderState({ status: SEARCH_STATUS.loading, query });
    historyRecorder?.recordQuery(query);

    try {
      const countries: readonly Country[] = await searchPort.search(
        query,
        cancellationSource.signal,
      );

      if (
        currentCancellationSource !== cancellationSource ||
        cancellationSource.signal.isCancelled
      ) {
        return;
      }

      currentCountries = countries;

      if (countries.length === 0) {
        renderState({ status: SEARCH_STATUS.empty, query });

        return;
      }

      renderState({ status: SEARCH_STATUS.results, query, countries });
    } catch (error: unknown) {
      if (
        currentCancellationSource !== cancellationSource ||
        cancellationSource.signal.isCancelled
      ) {
        return;
      }

      const classifiedError: ClassifiedSearchError | null =
        getSearchError(error);

      if (classifiedError === null) {
        return;
      }

      renderState({
        status: SEARCH_STATUS.error,
        query,
        ...classifiedError,
      });
    }
  }

  function applyQuery(rawQuery: string, shouldRunImmediately: boolean): void {
    cancelScheduledSearch();
    cancelCurrentSearch();

    currentQuery = rawQuery.trim();
    currentCountries = [];
    selectedCountry = null;

    if (currentQuery.length === 0) {
      renderState({ status: SEARCH_STATUS.idle });

      return;
    }

    const cancellationSource: SearchCancellationSource =
      createSearchCancellationSource();

    currentCancellationSource = cancellationSource;

    if (shouldRunImmediately) {
      void executeCountrySearch(currentQuery, cancellationSource);

      return;
    }

    renderState({ status: SEARCH_STATUS.waiting, query: currentQuery });
    scheduledTask = schedulerFactory((): void => {
      scheduledTask = null;
      void executeCountrySearch(currentQuery, cancellationSource);
    }, SEARCH_DEBOUNCE_DELAY_MS);
  }

  const searchController: SearchController = {
    updateSearchQuery(rawQuery: string): void {
      applyQuery(rawQuery, false);
    },

    retrySearch(): void {
      applyQuery(currentQuery, true);
    },

    searchFromHistory(query: string): void {
      applyQuery(query, true);
    },

    selectCountry(countryId: string): void {
      selectedCountry =
        currentCountries.find(
          (country: Country): boolean => country.id === countryId,
        ) ?? null;

      searchView.render(currentState, selectedCountry);
    },

    closeCountryDetails(): void {
      selectedCountry = null;
      searchView.render(currentState, selectedCountry);
    },

    destroy: destroySearchController,
  };

  searchView.render(currentState, selectedCountry);

  return searchController;
}
