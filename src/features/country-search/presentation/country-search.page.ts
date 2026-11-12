import { formatNumber } from '@/shared/utils/format-number';

import type { Country } from '../domain/country.type';

export type SearchCountries = (
  query: string,
  signal: AbortSignal,
) => Promise<Country[]>;

// TODO: Add country details here if the interface later needs a detail view.
function createCountryCard(country: Country): HTMLLIElement {
  const card: HTMLLIElement = document.createElement('li');

  card.className = 'country-card';

  const flag: HTMLSpanElement = document.createElement('span');

  flag.className = 'country-flag';
  flag.setAttribute('aria-hidden', 'true');
  flag.textContent = country.flag;

  const details: HTMLDivElement = document.createElement('div');

  details.className = 'country-details';

  const name: HTMLHeadingElement = document.createElement('h2');

  name.textContent = country.name;

  const location: HTMLParagraphElement = document.createElement('p');

  location.textContent = `${country.capital ?? 'No capital listed'} · ${country.region}`;

  const population: HTMLParagraphElement = document.createElement('p');

  population.className = 'country-population';
  population.textContent = `${formatNumber(country.population)} people`;
  details.append(name, location, population);
  card.append(flag, details);

  return card;
}

export function renderCountrySearchPage(
  root: HTMLElement,
  searchCountries: SearchCountries,
  recordQuery: (query: string) => void,
): void {
  const page: HTMLElement = document.createElement('main');

  page.className = 'page-shell';

  const header: HTMLElement = document.createElement('header');

  header.className = 'site-header';

  const brand: HTMLParagraphElement = document.createElement('p');

  brand.className = 'brand';
  brand.textContent = 'COUNTRY ATLAS';

  const headerNote: HTMLParagraphElement = document.createElement('p');

  headerNote.className = 'header-note';
  headerNote.textContent = 'A little closer to everywhere';
  header.append(brand, headerNote);

  const intro: HTMLElement = document.createElement('section');

  intro.className = 'intro';

  const eyebrow: HTMLParagraphElement = document.createElement('p');

  eyebrow.className = 'eyebrow';
  eyebrow.textContent = 'THE WORLD, AT A GLANCE';

  const title: HTMLHeadingElement = document.createElement('h1');

  title.textContent = 'A place begins with a name.';

  const description: HTMLParagraphElement = document.createElement('p');

  description.className = 'intro-copy';
  description.textContent =
    'Search for a country and discover the details that make it unique.';
  intro.append(eyebrow, title, description);

  const form: HTMLFormElement = document.createElement('form');

  form.className = 'search-form';

  const label: HTMLLabelElement = document.createElement('label');

  label.className = 'search-label';
  label.htmlFor = 'country-search';
  label.textContent = 'START EXPLORING';

  const searchBox: HTMLDivElement = document.createElement('div');

  searchBox.className = 'search-box';

  const searchIcon: HTMLSpanElement = document.createElement('span');

  searchIcon.className = 'search-icon';
  searchIcon.setAttribute('aria-hidden', 'true');
  searchIcon.textContent = '⌕';

  const input: HTMLInputElement = document.createElement('input');

  input.className = 'search-input';
  input.id = 'country-search';
  input.type = 'search';
  input.placeholder = 'Try “Japan” or “Costa Rica”';
  input.autocomplete = 'off';

  const submitButton: HTMLButtonElement = document.createElement('button');

  submitButton.className = 'search-button';
  submitButton.type = 'submit';
  submitButton.textContent = 'Search';
  searchBox.append(searchIcon, input, submitButton);

  const status: HTMLParagraphElement = document.createElement('p');

  status.className = 'search-status';
  status.setAttribute('role', 'status');
  status.textContent = 'Enter a country name to begin.';
  form.append(label, searchBox, status);

  const results: HTMLUListElement = document.createElement('ul');

  results.className = 'country-results';
  results.setAttribute('aria-label', 'Country search results');

  let activeController: AbortController | undefined;

  async function executeSearch(): Promise<void> {
    const query: string = input.value.trim();

    if (query.length === 0) {
      status.textContent = 'Enter a country name to begin.';
      results.replaceChildren();

      return;
    }

    recordQuery(query);
    activeController?.abort();

    const controller: AbortController = new AbortController();

    activeController = controller;
    status.textContent = 'Searching countries…';
    results.replaceChildren();

    try {
      const countries: Country[] = await searchCountries(
        query,
        controller.signal,
      );

      if (controller.signal.aborted) {
        return;
      }

      if (countries.length === 0) {
        status.textContent = 'No countries found. Try another name.';

        return;
      }

      status.textContent = `${countries.length} countries found.`;
      results.replaceChildren(...countries.map(createCountryCard));
    } catch (error: unknown) {
      if (controller.signal.aborted) {
        return;
      }

      status.textContent =
        error instanceof Error ? error.message : 'Something went wrong.';
    }
  }

  form.addEventListener('submit', (event: SubmitEvent): void => {
    event.preventDefault();

    void executeSearch();
  });

  const footer: HTMLElement = document.createElement('footer');

  footer.className = 'page-footer';

  const footerNote: HTMLSpanElement = document.createElement('span');

  footerNote.textContent = 'BUILT FOR THE CURIOUS';
  page.append(header, intro, form, results, footer);
  footer.append(footerNote);
  root.replaceChildren(page);
}
