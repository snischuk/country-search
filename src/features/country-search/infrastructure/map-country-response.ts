import type { Country } from '../domain/country.type';

export function mapCountryResponse(rawCountry: unknown): Country {
  void rawCountry;
  throw new Error('Not implemented');
}
