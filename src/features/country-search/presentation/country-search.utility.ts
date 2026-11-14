import type { Currency } from '../domain/country.type';
import { SEARCH_STATUS } from '../domain/search-state.type';
import type { SearchState } from '../domain/search-state.type';

export const UNAVAILABLE_VALUE: string = 'Not available';

export function formatPopulation(population: number | null): string {
  return population === null
    ? UNAVAILABLE_VALUE
    : new Intl.NumberFormat('en').format(population);
}

export function formatCurrency(currency: Currency): string {
  const currencyParts: string[] = [currency.name];

  if (currency.code !== null) {
    currencyParts.push(currency.code);
  }

  if (currency.symbol !== null) {
    currencyParts.push(currency.symbol);
  }

  return currencyParts.join(' · ');
}

export function getStatusMessage(state: SearchState): string {
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
      return '';
  }
}
