import type { SearchHistoryStorage } from '../application/search-history-storage';

const storageKey: string = 'country-search-history';

// TODO: Add a different adapter for IndexedDB or an API, preserving the same port.
export function createLocalStorageHistoryStorage(): SearchHistoryStorage {
  return {
    load(): string[] {
      try {
        const storedValue: string | null = localStorage.getItem(storageKey);

        if (storedValue === null) {
          return [];
        }

        const parsedValue: unknown = JSON.parse(storedValue);

        return Array.isArray(parsedValue)
          ? parsedValue.filter(
              (value: unknown): value is string => typeof value === 'string',
            )
          : [];
      } catch {
        return [];
      }
    },

    save(queries: readonly string[]): void {
      try {
        localStorage.setItem(storageKey, JSON.stringify(queries));
      } catch {
        // The service retains its in-memory state when browser storage is unavailable.
      }
    },
  };
}
