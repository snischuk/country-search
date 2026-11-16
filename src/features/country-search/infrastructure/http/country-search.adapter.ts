import type {
  SearchCancellationSignal,
  SearchPort,
} from '@/features/country-search/application/search.port';
import type { Country } from '@/features/country-search/domain/country.type';
import { searchCountries } from '@/features/country-search/infrastructure/http/search-countries.adapter';

export function createSearchCountriesAdapter(): SearchPort {
  return {
    async search(
      query: string,
      cancellationSignal: SearchCancellationSignal,
    ): Promise<readonly Country[]> {
      const controller: AbortController = new AbortController();
      const removeCancellationCallback: () => void =
        cancellationSignal.onCancel((): void => {
          controller.abort();
        });

      try {
        if (cancellationSignal.isCancelled) {
          controller.abort();
        }

        return await searchCountries(query, controller.signal);
      } finally {
        removeCancellationCallback();
      }
    },
  };
}
