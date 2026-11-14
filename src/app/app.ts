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
import { createSearchHistoryPanel } from '@/features/search-history';
import type { SearchHistoryPanel } from '@/features/search-history';
import {
  createHistoryService,
  createLocalStorageHistoryAdapter,
} from '@/services/search-history';
import type { HistoryService } from '@/services/search-history';
import {
  getIsDarkThemePreferred,
  saveThemePreference,
} from '@/shared/infrastructure/theme/theme.adapter';

import { createThemeToggle } from './components/theme-toggle/theme-toggle.component';
import { createCountrySearchPage } from './pages/country-search.page';

const LIGHT_THEME_CLASS: string = 'light-theme';
const THEME_COLOR_SELECTOR: string = 'meta[name="theme-color"]';
const BACKGROUND_COLOR_PROPERTY: string = '--color-paper';

function applyThemeAppearance(isDarkTheme: boolean): void {
  const root: HTMLElement = document.documentElement;

  root.classList.toggle(LIGHT_THEME_CLASS, !isDarkTheme);
  const themeColor: HTMLMetaElement | null =
    document.querySelector(THEME_COLOR_SELECTOR);

  if (themeColor !== null) {
    themeColor.content = getComputedStyle(root)
      .getPropertyValue(BACKGROUND_COLOR_PROPERTY)
      .trim();
  }
}

export function startApp(container: HTMLElement): () => void {
  const isDarkTheme: boolean = getIsDarkThemePreferred();

  applyThemeAppearance(isDarkTheme);
  const themeToggle: HTMLButtonElement = createThemeToggle(
    isDarkTheme,
    (isDarkThemeSelected: boolean): void => {
      applyThemeAppearance(isDarkThemeSelected);
      saveThemePreference(isDarkThemeSelected);
    },
  );

  const historyService: HistoryService = createHistoryService(
    createLocalStorageHistoryAdapter(),
  );
  const historyPanel: SearchHistoryPanel = createSearchHistoryPanel(
    historyService,
    {
      onSelect(query: string): void {
        controller.searchFromHistory(query);
      },
    },
  );
  const searchPanel: CountrySearchPanel = createCountrySearchPanel(
    {
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
    },
    historyPanel.element,
  );
  const transport: SearchPort = { search: searchCountries };
  const searchPort: SearchPort = createCachedSearchPort(transport);
  const schedulerFactory: SchedulerFactory = createDebounceSchedulerFactory(
    createBrowserTimerDriver(),
  );
  const controller: SearchController = createSearchController(
    searchPort,
    searchPanel.view,
    schedulerFactory,
    historyService,
  );

  const page: HTMLElement = createCountrySearchPage(
    searchPanel.element,
    themeToggle,
  );

  container.append(page);

  return (): void => {
    controller.destroy();
    historyPanel.destroy();
    page.remove();
  };
}
