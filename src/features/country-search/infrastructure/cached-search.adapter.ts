import type {
  SearchCancellationSignal,
  SearchPort,
} from '../application/search.port';
import type { Country } from '../domain/country.type';

const ABORT_ERROR_NAME: string = 'AbortError';
const REQUEST_CANCELLED_MESSAGE: string = 'The request was cancelled.';

export function createCachedSearchPort(searchPort: SearchPort): SearchPort {
  const completedQueries: Map<string, readonly Country[]> = new Map();

  return {
    async search(
      query: string,
      cancellationSignal: SearchCancellationSignal,
    ): Promise<readonly Country[]> {
      if (cancellationSignal.isCancelled) {
        throw new DOMException(REQUEST_CANCELLED_MESSAGE, ABORT_ERROR_NAME);
      }

      const normalizedQuery: string = query.trim();
      const cachedCountries: readonly Country[] | undefined =
        completedQueries.get(normalizedQuery);

      if (cachedCountries !== undefined) {
        return cachedCountries;
      }

      const countries: readonly Country[] = await searchPort.search(
        normalizedQuery,
        cancellationSignal,
      );

      if (cancellationSignal.isCancelled) {
        throw new DOMException(REQUEST_CANCELLED_MESSAGE, ABORT_ERROR_NAME);
      }

      completedQueries.set(normalizedQuery, countries);

      return countries;
    },
  };
}
