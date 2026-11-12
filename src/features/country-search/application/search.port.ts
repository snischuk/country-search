import type { Country } from '../domain/country.type';
import type { SearchState } from '../domain/search-state.type';

export interface SearchPort {
  search(query: string, signal: AbortSignal): Promise<readonly Country[]>;
}

export interface SearchView {
  render(state: SearchState, selectedCountry: Country | null): void;
}

export interface ScheduledTask {
  invoke(): void;
  cancel(): void;
}

export type SchedulerFactory = (
  callback: () => void,
  delay: number,
) => ScheduledTask;

export interface HistoryRecorder {
  recordQuery(query: string): void;
}

export interface SearchController {
  updateSearchQuery(rawQuery: string): void;
  retrySearch(): void;
  searchFromHistory(query: string): void;
  selectCountry(countryId: string): void;
  closeCountryDetails(): void;
  dispose(): void;
}
