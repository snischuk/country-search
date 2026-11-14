import { createSearchCancellationSource } from '../application/search-cancellation';
import type {
  SearchCancellationSignal,
  SearchCancellationSource,
  SearchPort,
} from '../application/search.port';
import type { Country } from '../domain/country.type';

const ABORT_ERROR_NAME: string = 'AbortError';
const REQUEST_CANCELLED_MESSAGE: string = 'The request was cancelled.';

interface SharedQuery {
  readonly cancellation: SearchCancellationSource;
  readonly result: Promise<readonly Country[]>;
  consumerCount: number;
  isSettled: boolean;
}

function createAbortError(): DOMException {
  return new DOMException(REQUEST_CANCELLED_MESSAGE, ABORT_ERROR_NAME);
}

export function createCachedSearchPort(searchPort: SearchPort): SearchPort {
  const completedQueries: Map<string, readonly Country[]> = new Map();
  const pendingQueries: Map<string, SharedQuery> = new Map();

  async function requestCountries(
    query: string,
    cancellationSignal: SearchCancellationSignal,
  ): Promise<readonly Country[]> {
    return searchPort.search(query, cancellationSignal);
  }

  function finishQuery(query: string, entry: SharedQuery): void {
    entry.isSettled = true;

    if (pendingQueries.get(query) === entry) {
      pendingQueries.delete(query);
    }
  }

  function createSharedQuery(query: string): SharedQuery {
    const cancellation: SearchCancellationSource =
      createSearchCancellationSource();
    const result: Promise<readonly Country[]> = requestCountries(
      query,
      cancellation.signal,
    );
    const entry: SharedQuery = {
      cancellation,
      result,
      consumerCount: 0,
      isSettled: false,
    };

    pendingQueries.set(query, entry);
    void result.then(
      (countries: readonly Country[]): void => {
        if (
          !cancellation.signal.isCancelled &&
          pendingQueries.get(query) === entry
        ) {
          completedQueries.set(query, countries);
        }

        finishQuery(query, entry);
      },
      (): void => {
        finishQuery(query, entry);
      },
    );

    return entry;
  }

  function attachCaller(
    query: string,
    entry: SharedQuery,
    cancellationSignal: SearchCancellationSignal,
  ): Promise<readonly Country[]> {
    let isAttached: boolean = true;
    let removeCancellationCallback = (): void => {};

    entry.consumerCount++;

    function detachCaller(): void {
      if (!isAttached) {
        return;
      }

      isAttached = false;
      removeCancellationCallback();
      entry.consumerCount--;

      if (!entry.isSettled && entry.consumerCount === 0) {
        if (pendingQueries.get(query) === entry) {
          pendingQueries.delete(query);
        }

        entry.cancellation.cancel();
      }
    }

    const callerResult: Promise<readonly Country[]> = new Promise<
      readonly Country[]
    >(
      (
        resolve: (countries: readonly Country[]) => void,
        reject: (error: unknown) => void,
      ): void => {
        removeCancellationCallback = cancellationSignal.onCancel((): void => {
          detachCaller();
          reject(createAbortError());
        });

        if (!isAttached) {
          removeCancellationCallback();
        }

        void entry.result.then(resolve, reject);
      },
    );

    return callerResult.finally(detachCaller);
  }

  return {
    async search(
      query: string,
      cancellationSignal: SearchCancellationSignal,
    ): Promise<readonly Country[]> {
      if (cancellationSignal.isCancelled) {
        throw createAbortError();
      }

      const normalizedQuery: string = query.trim();
      const cachedCountries: readonly Country[] | undefined =
        completedQueries.get(normalizedQuery);

      if (cachedCountries !== undefined) {
        return cachedCountries;
      }

      const entry: SharedQuery =
        pendingQueries.get(normalizedQuery) ??
        createSharedQuery(normalizedQuery);

      return attachCaller(normalizedQuery, entry, cancellationSignal);
    },
  };
}
