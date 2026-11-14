import type { HistoryStorage } from '@/services/search-history/application/history-storage.port';
import type { KeyValueStorage } from '@/shared/application/storage/key-value-storage.port';
import { localStorageService } from '@/shared/infrastructure/storage/local-storage.adapter';

const STORAGE_KEY: string = 'country-search.history.v1';
const STORAGE_VERSION: number = 1;

interface HistoryStorageDto {
  version: number;
  queries: unknown[];
}

export function createLocalStorageHistoryAdapter(
  storage: KeyValueStorage = localStorageService,
): HistoryStorage {
  let memoryQueries: readonly string[] = [];

  function load(): readonly string[] {
    try {
      const serializedDto: string | null = storage.getItem(STORAGE_KEY);

      if (serializedDto === null) {
        return memoryQueries;
      }

      const parsedDto: unknown = JSON.parse(serializedDto);

      if (!isHistoryStorageDto(parsedDto)) {
        return [];
      }

      const validQueries: string[] = parsedDto.queries.filter(
        (query: unknown): query is string => typeof query === 'string',
      );

      memoryQueries = validQueries;

      return memoryQueries;
    } catch {
      return memoryQueries;
    }
  }

  function save(queries: readonly string[]): void {
    memoryQueries = [...queries];

    storage.setItem(
      STORAGE_KEY,
      JSON.stringify({ version: STORAGE_VERSION, queries: memoryQueries }),
    );
  }

  return { load, save };
}

function isHistoryStorageDto(value: unknown): value is HistoryStorageDto {
  return (
    typeof value === 'object' &&
    value !== null &&
    'version' in value &&
    value.version === STORAGE_VERSION &&
    'queries' in value &&
    Array.isArray(value.queries)
  );
}
