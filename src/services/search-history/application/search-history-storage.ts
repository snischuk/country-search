// Storage implementations satisfy this contract; application never imports them.
export interface SearchHistoryStorage {
  load(): string[];
  save(queries: readonly string[]): void;
}
