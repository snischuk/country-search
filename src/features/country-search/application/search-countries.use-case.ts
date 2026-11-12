import type { Country } from '../domain/country.type';

export interface CountrySearchGateway {
  search(query: string, signal: AbortSignal): Promise<Country[]>;
}

export type SearchCountriesUseCase = (
  query: string,
  signal: AbortSignal,
) => Promise<Country[]>;

// TODO: Keep search workflow rules here; leave UI and HTTP details to other layers.
export function createSearchCountriesUseCase(
  gateway: CountrySearchGateway,
): SearchCountriesUseCase {
  return (query: string, signal: AbortSignal): Promise<Country[]> => {
    const normalizedQuery: string = query.trim();

    if (normalizedQuery.length === 0) {
      return Promise.resolve([]);
    }

    return gateway.search(normalizedQuery, signal);
  };
}
