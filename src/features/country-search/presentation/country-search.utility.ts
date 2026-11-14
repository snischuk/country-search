import type { Currency } from '@/features/country-search/domain/country.type';
import { SEARCH_STATUS } from '@/features/country-search/domain/search-state.type';
import type { SearchState } from '@/features/country-search/domain/search-state.type';
import { COUNTRY_ALPHA2_CODES } from '@/features/country-search/presentation/country-code.constant';

const COUNTRY_NAMES: Intl.DisplayNames = new Intl.DisplayNames(['en'], {
  type: 'region',
  fallback: 'none',
});

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
      return `${getCountryResultLabel(state.countries.length)} found for ${state.query}.`;
    case SEARCH_STATUS.empty:
      return `No countries found for ${state.query}. Check the spelling or try a shorter name.`;
    case SEARCH_STATUS.error:
      return '';
  }
}

export function getBorderCountryName(countryCode: string): string {
  const normalizedCode: string = countryCode.toUpperCase();
  const regionCode: string =
    COUNTRY_ALPHA2_CODES.get(normalizedCode) ?? normalizedCode;

  if (!/^[A-Z]{2}$/u.test(regionCode)) {
    return countryCode;
  }

  return COUNTRY_NAMES.of(regionCode) ?? countryCode;
}

export function getCountryResultLabel(countryCount: number): string {
  return `${countryCount} ${countryCount === 1 ? 'country' : 'countries'}`;
}
