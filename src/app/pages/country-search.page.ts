import './country-search.page.css';

export function createCountrySearchPage(
  searchPanel: HTMLElement,
  themeToggle: HTMLButtonElement,
): HTMLElement {
  const page: HTMLElement = document.createElement('main');
  const intro: HTMLElement = document.createElement('header');
  const toolbar: HTMLDivElement = document.createElement('div');
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

  toolbar.className = 'country-search-page__toolbar';
  toolbar.append(eyebrow, themeToggle);
  intro.append(toolbar, heading, description);
  page.append(intro, searchPanel);

  return page;
}
