import type { SearchView } from '../application/search.port';
import type { Country } from '../domain/country.type';
import { SEARCH_STATUS } from '../domain/search-state.type';
import type { SearchState } from '../domain/search-state.type';

export interface CountrySearchPageCallbacks {
  onQueryChange(rawQuery: string): void;
  onSubmit(): void;
  onRetry(): void;
  onSelectCountry(countryId: string): void;
}

export interface CountrySearchPage {
  readonly element: HTMLElement;
  readonly view: SearchView;
  focusSearchField(): void;
}

const UNAVAILABLE_VALUE: string = 'Not available';
const COUNTRY_FALLBACK_PREFIX_LENGTH: number = 2;

function createInformationItem(label: string, value: string): HTMLSpanElement {
  const item: HTMLSpanElement = document.createElement('span');
  const itemLabel: HTMLElement = document.createElement('span');
  const itemValue: HTMLElement = document.createElement('strong');

  item.className = 'country-card__fact';
  itemLabel.className = 'country-card__label';
  itemLabel.textContent = label;
  itemValue.className = 'country-card__value';
  itemValue.textContent = value;
  item.append(itemLabel, itemValue);

  return item;
}

function formatPopulation(population: number | null): string {
  return population === null
    ? UNAVAILABLE_VALUE
    : new Intl.NumberFormat('en').format(population);
}

function createCountryCard(
  country: Country,
  onSelectCountry: (countryId: string) => void,
): HTMLLIElement {
  const listItem: HTMLLIElement = document.createElement('li');
  const cardButton: HTMLButtonElement = document.createElement('button');
  const cardHeader: HTMLSpanElement = document.createElement('span');
  const cardFlag: HTMLElement | HTMLImageElement =
    country.flagUrl === null
      ? document.createElement('span')
      : document.createElement('img');
  const countryName: HTMLElement = document.createElement('strong');
  const countryFacts: HTMLSpanElement = document.createElement('span');

  listItem.className = 'country-results__item';
  cardButton.className = 'country-card';
  cardButton.type = 'button';
  cardHeader.className = 'country-card__header';
  cardFlag.className = 'country-card__flag';

  if (cardFlag instanceof HTMLImageElement && country.flagUrl !== null) {
    cardFlag.src = country.flagUrl;
    cardFlag.alt = `Flag of ${country.name}`;
    cardFlag.loading = 'lazy';
  } else {
    cardFlag.textContent =
      country.flagEmoji ??
      country.name.slice(0, COUNTRY_FALLBACK_PREFIX_LENGTH);

    cardFlag.setAttribute('aria-hidden', 'true');
  }

  countryName.className = 'country-card__name';
  countryName.textContent = country.name;
  countryFacts.className = 'country-card__facts';
  countryFacts.append(
    createInformationItem('Capital', country.capital ?? UNAVAILABLE_VALUE),
    createInformationItem('Region', country.region ?? UNAVAILABLE_VALUE),
    createInformationItem('Population', formatPopulation(country.population)),
  );

  cardHeader.append(cardFlag, countryName);
  cardButton.append(cardHeader, countryFacts);
  cardButton.addEventListener('click', (): void => {
    onSelectCountry(country.id);
  });

  listItem.append(cardButton);

  return listItem;
}

function getStatusMessage(state: SearchState): string {
  switch (state.status) {
    case SEARCH_STATUS.idle:
      return 'Search by country name to get started.';
    case SEARCH_STATUS.waiting:
      return `Searching for ${state.query} when you pause typing…`;
    case SEARCH_STATUS.loading:
      return `Searching for ${state.query}…`;
    case SEARCH_STATUS.results:
      return `${state.countries.length} countries found for ${state.query}.`;
    case SEARCH_STATUS.empty:
      return `No countries found for ${state.query}.`;
    case SEARCH_STATUS.error:
      return state.message;
  }
}

export function createCountrySearchPage(
  callbacks: CountrySearchPageCallbacks,
): CountrySearchPage {
  const page: HTMLElement = document.createElement('main');
  const intro: HTMLElement = document.createElement('header');
  const eyebrow: HTMLParagraphElement = document.createElement('p');
  const heading: HTMLHeadingElement = document.createElement('h1');
  const description: HTMLParagraphElement = document.createElement('p');
  const searchForm: HTMLFormElement = document.createElement('form');
  const searchLabel: HTMLLabelElement = document.createElement('label');
  const searchField: HTMLInputElement = document.createElement('input');
  const submitButton: HTMLButtonElement = document.createElement('button');
  const status: HTMLParagraphElement = document.createElement('p');
  const retryButton: HTMLButtonElement = document.createElement('button');
  const resultList: HTMLUListElement = document.createElement('ul');

  page.className = 'country-search';
  intro.className = 'country-search__intro';
  eyebrow.className = 'country-search__eyebrow';
  eyebrow.textContent = 'A field guide to the world';
  heading.className = 'country-search__title';
  heading.id = 'country-search-title';
  heading.textContent = 'Find your next place.';
  description.className = 'country-search__description';
  description.textContent =
    'Search for a country and explore the details that make it unique.';

  searchForm.className = 'country-search__form';
  searchLabel.className = 'country-search__label';
  searchLabel.htmlFor = 'country-search-input';
  searchLabel.textContent = 'Country name';
  searchField.id = 'country-search-input';
  searchField.className = 'country-search__input';
  searchField.type = 'search';
  searchField.name = 'country';
  searchField.autocomplete = 'off';
  searchField.placeholder = 'Try Japan or New Zealand';
  searchField.setAttribute('aria-describedby', 'country-search-hint');
  submitButton.className = 'country-search__submit';
  submitButton.type = 'submit';
  submitButton.textContent = 'Search now';
  searchForm.append(searchLabel, searchField, submitButton);

  const hint: HTMLParagraphElement = document.createElement('p');

  hint.id = 'country-search-hint';
  hint.className = 'country-search__hint';
  hint.textContent = 'Results update as you type.';

  status.className = 'country-search__status';
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  retryButton.className = 'country-search__retry';
  retryButton.type = 'button';
  retryButton.textContent = 'Try again';
  retryButton.hidden = true;
  resultList.className = 'country-results';
  resultList.setAttribute('aria-labelledby', 'country-search-title');

  intro.append(eyebrow, heading, description);
  page.append(intro, searchForm, hint, status, retryButton, resultList);

  searchField.addEventListener('input', (): void => {
    callbacks.onQueryChange(searchField.value);
  });

  searchForm.addEventListener('submit', (event: SubmitEvent): void => {
    event.preventDefault();
    callbacks.onSubmit();
  });

  retryButton.addEventListener('click', (): void => {
    callbacks.onRetry();
  });

  const view: SearchView = {
    render(state: SearchState): void {
      status.textContent = getStatusMessage(state);
      status.dataset['state'] = state.status;
      retryButton.hidden = state.status !== SEARCH_STATUS.error;
      resultList.replaceChildren();

      if (state.status === SEARCH_STATUS.results) {
        state.countries.forEach((country: Country): void => {
          resultList.append(
            createCountryCard(country, (countryId: string): void => {
              callbacks.onSelectCountry(countryId);
            }),
          );
        });
      }
    },
  };

  return {
    element: page,
    view,
    focusSearchField(): void {
      searchField.focus();
    },
  };
}
