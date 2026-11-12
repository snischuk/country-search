import type { Country } from '../domain/country.type';
import { SEARCH_ERROR_TYPES, SEARCH_STATUS } from '../domain/search-state.type';
import type { SearchState } from '../domain/search-state.type';

import type {
  ScheduledTask,
  SchedulerFactory,
  SearchController,
  SearchPort,
  SearchView,
} from './search.port';

const SEARCH_DEBOUNCE_DELAY_MS: number = 300;
const SEARCH_FAILED_MESSAGE: string = 'The search could not be completed.';

export function createSearchController(
  searchPort: SearchPort,
  searchView: SearchView,
  schedulerFactory: SchedulerFactory,
): SearchController {
  let currentQuery: string = '';
  let currentState: SearchState = { status: SEARCH_STATUS.idle };
  let currentCountries: readonly Country[] = [];
  let selectedCountry: Country | null = null;
  let currentAbortController: AbortController | null = null;
  let scheduledTask: ScheduledTask | null = null;

  function renderState(state: SearchState): void {
    currentState = state;
    searchView.render(state, selectedCountry);
  }

  function cancelScheduledSearch(): void {
    scheduledTask?.cancel();
    scheduledTask = null;
  }

  function abortCurrentSearch(): void {
    currentAbortController?.abort();
    currentAbortController = null;
  }

  function destroySearchController(): void {
    cancelScheduledSearch();
    abortCurrentSearch();
  }

  async function executeCountrySearch(
    query: string,
    requestController: AbortController,
  ): Promise<void> {
    if (
      currentAbortController !== requestController ||
      requestController.signal.aborted
    ) {
      return;
    }

    selectedCountry = null;
    renderState({ status: SEARCH_STATUS.loading, query });

    try {
      const countries: readonly Country[] = await searchPort.search(
        query,
        requestController.signal,
      );

      if (
        currentAbortController !== requestController ||
        requestController.signal.aborted
      ) {
        return;
      }

      currentCountries = countries;

      if (countries.length === 0) {
        renderState({ status: SEARCH_STATUS.empty, query });

        return;
      }

      renderState({ status: SEARCH_STATUS.results, query, countries });
    } catch {
      if (
        currentAbortController !== requestController ||
        requestController.signal.aborted
      ) {
        return;
      }

      renderState({
        status: SEARCH_STATUS.error,
        query,
        errorType: SEARCH_ERROR_TYPES.network,
        message: SEARCH_FAILED_MESSAGE,
        statusCode: null,
      });
    }
  }

  function applyQuery(rawQuery: string, shouldRunImmediately: boolean): void {
    cancelScheduledSearch();
    abortCurrentSearch();

    currentQuery = rawQuery.trim();
    currentCountries = [];
    selectedCountry = null;

    if (currentQuery.length === 0) {
      renderState({ status: SEARCH_STATUS.idle });

      return;
    }

    const requestController: AbortController = new AbortController();

    currentAbortController = requestController;

    if (shouldRunImmediately) {
      void executeCountrySearch(currentQuery, requestController);

      return;
    }

    renderState({ status: SEARCH_STATUS.waiting, query: currentQuery });
    scheduledTask = schedulerFactory((): void => {
      scheduledTask = null;
      void executeCountrySearch(currentQuery, requestController);
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
