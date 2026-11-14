import type { HistoryStorage } from '../application/history-storage.port';

const STORAGE_KEY: string = 'country-search.history.v1';
const STORAGE_VERSION: number = 1;

interface HistoryStorageDto {
  version: number;
  queries: unknown[];
}

export function createLocalStorageHistoryAdapter(): HistoryStorage {
  let memoryQueries: readonly string[] = [];

  function load(): readonly string[] {
    try {
      const serializedDto: string | null = localStorage.getItem(STORAGE_KEY);

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

    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ version: STORAGE_VERSION, queries: memoryQueries }),
      );
    } catch {
      return;
    }
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
