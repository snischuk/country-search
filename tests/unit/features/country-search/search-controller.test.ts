import { describe, expect, it } from 'vitest';

import { createSearchController } from '@/features/country-search/application/search-controller';
import {
  HttpError,
  ValidationError,
} from '@/features/country-search/application/search-errors';
import type {
  ScheduledTask,
  SchedulerFactory,
  SearchCancellationSignal,
  SearchController,
  SearchPort,
  SearchView,
} from '@/features/country-search/application/search.port';
import type { Country } from '@/features/country-search/domain/country.type';
import {
  SEARCH_ERROR_TYPES,
  SEARCH_STATUS,
} from '@/features/country-search/domain/search-state.type';
import type {
  SearchErrorType,
  SearchState,
} from '@/features/country-search/domain/search-state.type';

interface PendingSearch {
  readonly query: string;
  readonly cancellationSignal: SearchCancellationSignal;
  readonly resolve: (countries: readonly Country[]) => void;
  readonly reject: (error: unknown) => void;
}

interface ScheduledCall extends ScheduledTask {
  isCancelled(): boolean;
}

interface SearchHarness {
  readonly controller: SearchController;
  readonly pendingSearches: PendingSearch[];
  readonly renderedStates: SearchState[];
  readonly scheduledTasks: ScheduledCall[];
  readonly scheduledDelays: number[];
}

function createCountry(name: string): Country {
  return {
    id: name,
    name,
    flagUrl: null,
    flagEmoji: null,
    capital: null,
    region: null,
    population: null,
    area: null,
    languages: [],
    currencies: [],
    borders: [],
    description: name,
  };
}

function createSearchHarness(): SearchHarness {
  const pendingSearches: PendingSearch[] = [];
  const renderedStates: SearchState[] = [];
  const scheduledTasks: ScheduledCall[] = [];
  const scheduledDelays: number[] = [];

  const searchPort: SearchPort = {
    search(
      query: string,
      cancellationSignal: SearchCancellationSignal,
    ): Promise<readonly Country[]> {
      return new Promise<readonly Country[]>(
        (
          resolve: (countries: readonly Country[]) => void,
          reject: (error: unknown) => void,
        ): void => {
          pendingSearches.push({ query, cancellationSignal, resolve, reject });
        },
      );
    },
  };

  const searchView: SearchView = {
    render(state: SearchState): void {
      renderedStates.push(state);
    },
  };

  const createScheduledTask: SchedulerFactory = (
    callback: () => void,
    delayMilliseconds: number,
  ): ScheduledTask => {
    scheduledDelays.push(delayMilliseconds);

    let isCancelled: boolean = false;

    const scheduledTask: ScheduledCall = {
      invoke(): void {
        if (!isCancelled) {
          callback();
        }
      },

      cancel(): void {
        isCancelled = true;
      },

      isCancelled(): boolean {
        return isCancelled;
      },
    };

    scheduledTasks.push(scheduledTask);

    return scheduledTask;
  };

  const controller: SearchController = createSearchController(
    searchPort,
    searchView,
    createScheduledTask,
  );

  return {
    controller,
    pendingSearches,
    renderedStates,
    scheduledTasks,
    scheduledDelays,
  };
}

async function resolveMicrotasks(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

describe('createSearchController', (): void => {
  it('renders idle initially and waits 300 milliseconds before searching', (): void => {
    const {
      controller,
      renderedStates,
      scheduledTasks,
      scheduledDelays,
      pendingSearches,
    }: SearchHarness = createSearchHarness();

    expect(renderedStates.at(-1)).toEqual({ status: SEARCH_STATUS.idle });

    controller.updateSearchQuery(' Japan ');

    expect(renderedStates.at(-1)).toEqual({
      status: SEARCH_STATUS.waiting,
      query: 'Japan',
    });

    expect(scheduledDelays).toEqual([300]);
    expect(pendingSearches).toHaveLength(0);

    scheduledTasks[0]?.invoke();

    expect(renderedStates.at(-1)).toEqual({
      status: SEARCH_STATUS.loading,
      query: 'Japan',
    });

    expect(pendingSearches[0]?.query).toBe('Japan');
  });

  it('cancels the active request immediately when a new query arrives', (): void => {
    const {
      controller,
      scheduledTasks,
      pendingSearches,
      renderedStates,
    }: SearchHarness = createSearchHarness();

    controller.updateSearchQuery('Japan');
    scheduledTasks[0]?.invoke();
    const previousSignal: SearchCancellationSignal | undefined =
      pendingSearches[0]?.cancellationSignal;

    controller.updateSearchQuery('Canada');

    expect(previousSignal?.isCancelled).toBe(true);
    expect(renderedStates.at(-1)).toEqual({
      status: SEARCH_STATUS.waiting,
      query: 'Canada',
    });
  });

  it('cancels pending work and the active search on empty input', (): void => {
    const {
      controller,
      scheduledTasks,
      pendingSearches,
      renderedStates,
    }: SearchHarness = createSearchHarness();

    controller.updateSearchQuery('Japan');
    scheduledTasks[0]?.invoke();
    const activeSignal: SearchCancellationSignal | undefined =
      pendingSearches[0]?.cancellationSignal;

    controller.updateSearchQuery('');

    expect(activeSignal?.isCancelled).toBe(true);
    expect(renderedStates.at(-1)).toEqual({ status: SEARCH_STATUS.idle });
    expect(scheduledTasks[1]).toBeUndefined();
  });

  it('renders results when the current request resolves with countries', async (): Promise<void> => {
    const {
      controller,
      scheduledTasks,
      pendingSearches,
      renderedStates,
    }: SearchHarness = createSearchHarness();
    const japan: Country = createCountry('Japan');

    controller.updateSearchQuery('Japan');
    scheduledTasks[0]?.invoke();
    pendingSearches[0]?.resolve([japan]);

    await resolveMicrotasks();

    expect(renderedStates.at(-1)).toEqual({
      status: SEARCH_STATUS.results,
      query: 'Japan',
      countries: [japan],
    });
  });

  it('renders empty when the current request resolves without countries', async (): Promise<void> => {
    const {
      controller,
      scheduledTasks,
      pendingSearches,
      renderedStates,
    }: SearchHarness = createSearchHarness();

    controller.updateSearchQuery('No Such Country');
    scheduledTasks[0]?.invoke();
    pendingSearches[0]?.resolve([]);

    await resolveMicrotasks();

    expect(renderedStates.at(-1)).toEqual({
      status: SEARCH_STATUS.empty,
      query: 'No Such Country',
    });
  });

  it('does not let an older request overwrite the latest query results', async (): Promise<void> => {
    const {
      controller,
      scheduledTasks,
      pendingSearches,
      renderedStates,
    }: SearchHarness = createSearchHarness();
    const japan: Country = createCountry('Japan');
    const canada: Country = createCountry('Canada');

    controller.updateSearchQuery('Japan');
    scheduledTasks[0]?.invoke();
    controller.updateSearchQuery('Canada');
    scheduledTasks[1]?.invoke();

    pendingSearches[0]?.resolve([japan]);

    await resolveMicrotasks();

    expect(renderedStates.at(-1)).toEqual({
      status: SEARCH_STATUS.loading,
      query: 'Canada',
    });

    pendingSearches[1]?.resolve([canada]);

    await resolveMicrotasks();

    expect(renderedStates.at(-1)).toEqual({
      status: SEARCH_STATUS.results,
      query: 'Canada',
      countries: [canada],
    });
  });

  it('does not start a search for empty input', (): void => {
    const {
      controller,
      pendingSearches,
      scheduledTasks,
      renderedStates,
    }: SearchHarness = createSearchHarness();

    controller.updateSearchQuery('   ');

    expect(pendingSearches).toHaveLength(0);
    expect(scheduledTasks).toHaveLength(0);
    expect(renderedStates.at(-1)).toEqual({ status: SEARCH_STATUS.idle });
  });
});

describe('search controller errors and retry', (): void => {
  it.each([
    {
      error: { name: 'TimeoutError' },
      errorType: SEARCH_ERROR_TYPES.timeout,
      statusCode: null,
    },
    {
      error: new HttpError(503),
      errorType: SEARCH_ERROR_TYPES.http,
      statusCode: 503,
    },
    {
      error: new ValidationError(),
      errorType: SEARCH_ERROR_TYPES.invalidResponse,
      statusCode: null,
    },
  ])(
    'renders classified $errorType failures',
    async ({
      error,
      errorType,
      statusCode,
    }: {
      error: unknown;
      errorType: SearchErrorType;
      statusCode: number | null;
    }): Promise<void> => {
      const {
        controller,
        scheduledTasks,
        pendingSearches,
        renderedStates,
      }: SearchHarness = createSearchHarness();

      controller.updateSearchQuery('sp');
      scheduledTasks[0]?.invoke();
      pendingSearches[0]?.reject(error);

      await resolveMicrotasks();

      expect(renderedStates.at(-1)).toMatchObject({
        status: SEARCH_STATUS.error,
        query: 'sp',
        errorType,
        statusCode,
      });
    },
  );

  it('keeps an intentional AbortError silent', async (): Promise<void> => {
    const {
      controller,
      scheduledTasks,
      pendingSearches,
      renderedStates,
    }: SearchHarness = createSearchHarness();

    controller.updateSearchQuery('sp');
    scheduledTasks[0]?.invoke();
    pendingSearches[0]?.reject({ name: 'AbortError' });

    await resolveMicrotasks();

    expect(
      renderedStates.some(
        (state: SearchState): boolean => state.status === SEARCH_STATUS.error,
      ),
    ).toBe(false);
  });

  it('retries the latest failed query immediately after the input changes', async (): Promise<void> => {
    const {
      controller,
      scheduledTasks,
      pendingSearches,
      renderedStates,
    }: SearchHarness = createSearchHarness();

    controller.updateSearchQuery('sp');
    scheduledTasks[0]?.invoke();
    pendingSearches[0]?.reject(new TypeError('Failed to fetch'));

    await resolveMicrotasks();

    expect(renderedStates.at(-1)?.status).toBe(SEARCH_STATUS.error);

    controller.updateSearchQuery('spain');

    expect(renderedStates.at(-1)).toEqual({
      status: SEARCH_STATUS.waiting,
      query: 'spain',
    });

    scheduledTasks[1]?.invoke();
    pendingSearches[1]?.reject(new TypeError('Failed to fetch'));

    await resolveMicrotasks();

    expect(renderedStates.at(-1)).toMatchObject({
      status: SEARCH_STATUS.error,
      query: 'spain',
    });

    controller.retrySearch();

    expect(pendingSearches).toHaveLength(3);
    expect(pendingSearches[2]?.query).toBe('spain');
    expect(pendingSearches[1]?.cancellationSignal.isCancelled).toBe(true);
    expect(scheduledTasks).toHaveLength(2);
    expect(renderedStates.at(-1)).toEqual({
      status: SEARCH_STATUS.loading,
      query: 'spain',
    });

    const spain: Country = createCountry('Spain');

    pendingSearches[2]?.resolve([spain]);

    await resolveMicrotasks();

    expect(renderedStates.at(-1)).toEqual({
      status: SEARCH_STATUS.results,
      query: 'spain',
      countries: [spain],
    });
  });

  it('cancels pending debounce and the active consumer when retrying', (): void => {
    const { controller, scheduledTasks, pendingSearches }: SearchHarness =
      createSearchHarness();

    controller.updateSearchQuery('sp');
    scheduledTasks[0]?.invoke();
    controller.updateSearchQuery('spain');
    controller.retrySearch();

    expect(scheduledTasks[1]?.isCancelled()).toBe(true);
    expect(pendingSearches[0]?.cancellationSignal.isCancelled).toBe(true);
    expect(pendingSearches[1]?.query).toBe('spain');

    scheduledTasks[1]?.invoke();

    expect(pendingSearches).toHaveLength(2);

    controller.retrySearch();

    expect(pendingSearches[1]?.cancellationSignal.isCancelled).toBe(true);
    expect(pendingSearches[2]?.query).toBe('spain');
  });

  it('clears an error on empty input and ignores an empty retry', async (): Promise<void> => {
    const {
      controller,
      scheduledTasks,
      pendingSearches,
      renderedStates,
    }: SearchHarness = createSearchHarness();

    controller.updateSearchQuery('sp');
    scheduledTasks[0]?.invoke();
    pendingSearches[0]?.reject(new TypeError('Failed to fetch'));

    await resolveMicrotasks();

    controller.updateSearchQuery('   ');
    controller.retrySearch();

    expect(renderedStates.at(-1)).toEqual({ status: SEARCH_STATUS.idle });
    expect(pendingSearches).toHaveLength(1);
    expect(scheduledTasks).toHaveLength(1);
  });

  it.each([false, true])(
    'ignores stale failure when latest search started: %s',
    async (shouldStartLatest: boolean): Promise<void> => {
      const {
        controller,
        scheduledTasks,
        pendingSearches,
        renderedStates,
      }: SearchHarness = createSearchHarness();

      controller.updateSearchQuery('sp');
      scheduledTasks[0]?.invoke();
      controller.updateSearchQuery('spain');

      if (shouldStartLatest) {
        scheduledTasks[1]?.invoke();
      }

      pendingSearches[0]?.reject(new HttpError(503));

      await resolveMicrotasks();

      expect(renderedStates.at(-1)).toEqual({
        status: shouldStartLatest
          ? SEARCH_STATUS.loading
          : SEARCH_STATUS.waiting,
        query: 'spain',
      });
    },
  );
});
