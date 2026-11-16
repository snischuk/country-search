import type { Country } from '@/features/country-search/domain/country.type';

export function createCountry(name: string): Country {
  return {
    id: name,
    name,
    flagUrl: null,
    flagEmoji: null,
    capital: null,
    region: null,
    population: null,
    area: null,
    languages: [],
    currencies: [],
    borders: [],
    description: name,
  };
}
