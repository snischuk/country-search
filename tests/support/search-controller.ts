import { vi } from 'vitest';
import type { Mock } from 'vitest';

import { createSearchController } from '@/features/country-search/application/search-controller';
import type {
  HistoryRecorder,
  SearchController,
  SearchPort,
  SearchView,
} from '@/features/country-search/application/search.port';

interface ControllerSetup {
  readonly controller: SearchController;
  readonly search: Mock<SearchPort['search']>;
  readonly render: Mock<SearchView['render']>;
  readonly setQuery: Mock<(query: string) => void>;
}

export function createControllerSetup(
  historyRecorder?: HistoryRecorder,
  searchPort?: SearchPort,
): ControllerSetup {
  const search: Mock<SearchPort['search']> = vi
    .fn<SearchPort['search']>()
    .mockResolvedValue([]);
  const render: Mock<SearchView['render']> = vi.fn<SearchView['render']>();
  const setQuery: Mock<(query: string) => void> =
    vi.fn<(query: string) => void>();
  const controller: SearchController = createSearchController(
    searchPort ?? { search },
    { render, setQuery },
    (callback: () => void, delay: number): { cancel(): void } => {
      const timer: ReturnType<typeof setTimeout> = setTimeout(callback, delay);

      return {
        cancel(): void {
          clearTimeout(timer);
        },
      };
    },
    historyRecorder,
  );

  return { controller, search, render, setQuery };
}
