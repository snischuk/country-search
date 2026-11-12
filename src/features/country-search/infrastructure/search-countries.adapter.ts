import type { CountrySearchGateway } from '../application/search-countries.use-case';
import type { Country } from '../domain/country.type';

import { countriesDevelopmentApi } from './countries-development.api';

export { HttpError } from './countries-development.api';

// TODO: Map any additional API fields here, keeping API response shapes out of the domain.
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function mapCountryResponse(rawCountry: unknown): Country | null {
  if (!isRecord(rawCountry)) {
    return null;
  }

  const name: unknown = rawCountry['name'];
  const region: unknown = rawCountry['region'];
  const population: unknown = rawCountry['population'];
  const capital: unknown = rawCountry['capital'];
  const flag: unknown = rawCountry['flag'];

  if (
    typeof name !== 'string' ||
    typeof region !== 'string' ||
    typeof population !== 'number'
  ) {
    return null;
  }

  return {
    name,
    region,
    population,
    capital: typeof capital === 'string' ? capital : null,
    flag: typeof flag === 'string' ? flag : '🌍',
  };
}

export const countriesDevelopmentGateway: CountrySearchGateway = {
  async search(query: string, signal: AbortSignal): Promise<Country[]> {
    const responseBody: unknown[] = await countriesDevelopmentApi.searchByName(
      query,
      signal,
    );

    return responseBody.flatMap((rawCountry: unknown): Country[] => {
      const country: Country | null = mapCountryResponse(rawCountry);

      return country ? [country] : [];
    });
  },
};
