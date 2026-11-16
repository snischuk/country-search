import type { SearchView } from '@/features/country-search/application/search.port';
import type { Country } from '@/features/country-search/domain/country.type';
import { SEARCH_STATUS } from '@/features/country-search/domain/search-state.type';
import type { SearchState } from '@/features/country-search/domain/search-state.type';
import { createCountryCard } from '@/features/country-search/presentation/country-card/country-card.component';
import { createCountryDetails } from '@/features/country-search/presentation/country-details/country-details.component';
import type { CountryDetails } from '@/features/country-search/presentation/country-details/country-details.component';
import { createSearchFeedback } from '@/features/country-search/presentation/search-feedback/search-feedback.component';
import type { SearchFeedback } from '@/features/country-search/presentation/search-feedback/search-feedback.component';
import { createSearchForm } from '@/features/country-search/presentation/search-form/search-form.component';
import type { SearchForm } from '@/features/country-search/presentation/search-form/search-form.component';

import './country-search-panel.component.css';

export interface CountrySearchPanelCallbacks {
  onQueryChange(rawQuery: string): void;
  onSubmit(): void;
  onRetry(): void;
  onSelectCountry(countryId: string): void;
  onCloseDetails(): void;
}

export interface CountrySearchPanel {
  readonly element: HTMLElement;
  readonly view: SearchView;
}

export function createCountrySearchPanel(
  callbacks: CountrySearchPanelCallbacks,
  searchAccessory?: HTMLElement,
): CountrySearchPanel {
  const panel: HTMLElement = document.createElement('section');
  const search: SearchForm = createSearchForm(
    (query: string): void => {
      callbacks.onQueryChange(query);
    },
    (): void => {
      callbacks.onSubmit();
    },
  );
  const feedback: SearchFeedback = createSearchFeedback(
    (): void => {
      callbacks.onRetry();
    },
    (): HTMLElement => search.field,
  );
  const resultList: HTMLUListElement = document.createElement('ul');
  let selectedCountryButton: HTMLButtonElement | null = null;
  let renderedCountries: readonly Country[] | null = null;
  const details: CountryDetails = createCountryDetails(
    (): void => {
      callbacks.onCloseDetails();
    },
    (): HTMLElement =>
      selectedCountryButton?.isConnected ? selectedCountryButton : search.field,
  );

  panel.className = 'country-search';
  panel.setAttribute('aria-label', 'Country search');

  resultList.className = 'country-results';
  resultList.setAttribute('aria-label', 'Countries');
  panel.append(search.element);

  if (searchAccessory !== undefined) {
    panel.append(searchAccessory);
  }

  panel.append(feedback.element, resultList, details.element);

  const view: SearchView = {
    setQuery(query: string): void {
      search.field.value = query;
    },
    render(state: SearchState, selectedCountry: Country | null): void {
      if (window.scrollY > 0) {
        const visiblePanelHeight: number = Math.max(
          0,
          window.innerHeight - panel.getBoundingClientRect().top,
        );

        panel.style.minBlockSize = `${visiblePanelHeight}px`;
      } else {
        panel.style.minBlockSize = '';
      }

      resultList.setAttribute(
        'aria-busy',
        String(
          state.status === SEARCH_STATUS.loading ||
            state.status === SEARCH_STATUS.waiting,
        ),
      );

      feedback.render(state);
      const countries: readonly Country[] | null =
        state.status === SEARCH_STATUS.results ? state.countries : null;

      if (countries !== renderedCountries) {
        renderedCountries = countries;
        resultList.replaceChildren();
        countries?.forEach((country: Country): void => {
          const card: HTMLLIElement = createCountryCard(
            country,
            (countryId: string, trigger: HTMLButtonElement): void => {
              selectedCountryButton = trigger;
              callbacks.onSelectCountry(countryId);
            },
          );

          resultList.append(card);
        });
      }

      details.render(selectedCountry);
    },
  };

  return {
    element: panel,
    view,
  };
}
