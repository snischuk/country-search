import './country-search.page.css';

export function createCountrySearchPage(
  searchPanel: HTMLElement,
  historyPanel: HTMLElement,
): HTMLElement {
  const page: HTMLElement = document.createElement('main');
  const intro: HTMLElement = document.createElement('header');
  const eyebrow: HTMLParagraphElement = document.createElement('p');
  const heading: HTMLHeadingElement = document.createElement('h1');
  const description: HTMLParagraphElement = document.createElement('p');

  page.className = 'country-search-page';
  intro.className = 'country-search-page__intro';
  eyebrow.className = 'country-search-page__eyebrow';
  eyebrow.textContent = 'A field guide to the world';
  heading.className = 'country-search-page__title';
  heading.textContent = 'Find your next place.';
  description.className = 'country-search-page__description';
  description.textContent =
    'Search for a country and explore the details that make it unique.';

  intro.append(eyebrow, heading, description);
  page.append(intro, searchPanel, historyPanel);

  return page;
}
