import { createButton } from '@/shared/presentation/ui-kit';

import type { Country } from '../../domain/country.type';
import { UNAVAILABLE_VALUE, formatPopulation } from '../country-search.utility';

import './country-card.component.css';

const COUNTRY_FALLBACK_PREFIX_LENGTH: number = 2;

export function createCountryCard(
  country: Country,
  onSelectCountry: (countryId: string, trigger: HTMLButtonElement) => void,
): HTMLLIElement {
  const listItem: HTMLLIElement = document.createElement('li');
  const cardButton: HTMLButtonElement = createButton();
  const cardHeader: HTMLSpanElement = document.createElement('span');
  const cardFlag: HTMLElement | HTMLImageElement =
    country.flagUrl === null
      ? document.createElement('span')
      : document.createElement('img');
  const countryName: HTMLElement = document.createElement('strong');
  const countryFacts: HTMLSpanElement = document.createElement('span');

  listItem.className = 'country-results__item';
  cardButton.classList.add('country-card');
  cardButton.type = 'button';
  cardButton.setAttribute('aria-haspopup', 'dialog');
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
  const information: { label: string; text: string }[] = [
    { label: 'Capital', text: country.capital ?? UNAVAILABLE_VALUE },
    { label: 'Region', text: country.region ?? UNAVAILABLE_VALUE },
    { label: 'Population', text: formatPopulation(country.population) },
  ];

  information.forEach((fact: { label: string; text: string }): void => {
    const row: HTMLSpanElement = document.createElement('span');
    const label: HTMLSpanElement = document.createElement('span');
    const text: HTMLElement = document.createElement('strong');

    row.className = 'country-card__fact';
    label.className = 'country-card__label';
    label.textContent = fact.label;
    text.className = 'country-card__value';
    text.textContent = fact.text;
    row.append(label, text);
    countryFacts.append(row);
  });

  cardHeader.append(cardFlag, countryName);
  cardButton.append(cardHeader, countryFacts);
  cardButton.addEventListener('click', (): void => {
    onSelectCountry(country.id, cardButton);
  });

  listItem.append(cardButton);

  return listItem;
}
