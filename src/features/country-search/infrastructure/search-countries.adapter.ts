import type { Country } from '../domain/country.type';

export function searchCountries(
  query: string,
  signal: AbortSignal,
): Promise<readonly Country[]> {
  void query;
  void signal;

  return Promise.reject(new Error('Not implemented'));
}
