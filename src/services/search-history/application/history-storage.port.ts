export interface HistoryStorage {
  load(): readonly string[];
  save(queries: readonly string[]): void;
}
