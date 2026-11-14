import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  HttpError,
  ValidationError,
} from '@/features/country-search/application/search-errors';
import type { SearchCancellationSignal } from '@/features/country-search/application/search.port';
import type { Country } from '@/features/country-search/domain/country.type';
import {
  SEARCH_ERROR_TYPES,
  SEARCH_STATUS,
} from '@/features/country-search/domain/search-state.type';
import type {
  SearchErrorType,
  SearchState,
} from '@/features/country-search/domain/search-state.type';

import { createCountry } from '../../../support/country';
import { createDeferred } from '../../../support/deferred';
import type { Deferred } from '../../../support/deferred';
import { createControllerSetup } from '../../../support/search-controller';

beforeEach((): void => {
  vi.useFakeTimers();
});

afterEach((): void => {
  vi.clearAllTimers();
  vi.useRealTimers();
});

describe('search query lifecycle', (): void => {
  it('renders idle before any input', (): void => {
    const { render }: ReturnType<typeof createControllerSetup> =
      createControllerSetup();

    expect(render).toHaveBeenLastCalledWith(
      { status: SEARCH_STATUS.idle },
      null,
    );
  });

  it('trims input and searches only after the complete debounce delay', async (): Promise<void> => {
    const {
      controller,
      search,
      render,
    }: ReturnType<typeof createControllerSetup> = createControllerSetup();
    const response: Deferred<readonly Country[]> = createDeferred();

    search.mockReturnValue(response.promise);
    controller.updateSearchQuery(' Japan ');

    expect(render).toHaveBeenLastCalledWith(
      { status: SEARCH_STATUS.waiting, query: 'Japan' },
      null,
    );

    await vi.advanceTimersByTimeAsync(299);
    expect(search).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(search).toHaveBeenCalledExactlyOnceWith('Japan', expect.anything());
    expect(render).toHaveBeenLastCalledWith(
      { status: SEARCH_STATUS.loading, query: 'Japan' },
      null,
    );

    response.resolve([]);
    await vi.advanceTimersByTimeAsync(0);
  });

  it('restarts debounce and searches only the latest input', async (): Promise<void> => {
    const { controller, search }: ReturnType<typeof createControllerSetup> =
      createControllerSetup();

    controller.updateSearchQuery('sp');
    await vi.advanceTimersByTimeAsync(200);
    controller.updateSearchQuery('spain');
    await vi.advanceTimersByTimeAsync(299);
    expect(search).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(search).toHaveBeenCalledExactlyOnceWith('spain', expect.anything());
  });

  it('cancels the active request as soon as input changes', async (): Promise<void> => {
    const {
      controller,
      search,
      render,
    }: ReturnType<typeof createControllerSetup> = createControllerSetup();

    controller.updateSearchQuery('Japan');
    await vi.advanceTimersByTimeAsync(300);
    const previousSignal: SearchCancellationSignal | undefined =
      search.mock.calls[0]?.[1];

    controller.updateSearchQuery('Canada');

    expect(previousSignal?.isCancelled).toBe(true);
    expect(search).toHaveBeenCalledTimes(1);
    expect(render).toHaveBeenLastCalledWith(
      { status: SEARCH_STATUS.waiting, query: 'Canada' },
      null,
    );
  });

  it.each(['', '   '])(
    'does not schedule a blank query %j',
    async (query: string): Promise<void> => {
      const {
        controller,
        search,
        render,
      }: ReturnType<typeof createControllerSetup> = createControllerSetup();

      controller.updateSearchQuery(query);
      controller.retrySearch();
      await vi.runAllTimersAsync();

      expect(search).not.toHaveBeenCalled();
      expect(render).toHaveBeenLastCalledWith(
        { status: SEARCH_STATUS.idle },
        null,
      );
    },
  );

  it('clears the view and cancels pending debounce on empty input', async (): Promise<void> => {
    const {
      controller,
      search,
      render,
    }: ReturnType<typeof createControllerSetup> = createControllerSetup();

    controller.updateSearchQuery('Japan');
    controller.updateSearchQuery('');
    await vi.runAllTimersAsync();

    expect(search).not.toHaveBeenCalled();
    expect(render).toHaveBeenLastCalledWith(
      { status: SEARCH_STATUS.idle },
      null,
    );
  });

  it('cancels an active search when input is cleared', async (): Promise<void> => {
    const {
      controller,
      search,
      render,
    }: ReturnType<typeof createControllerSetup> = createControllerSetup();

    controller.updateSearchQuery('Japan');
    await vi.advanceTimersByTimeAsync(300);
    controller.updateSearchQuery('');

    expect(search.mock.calls[0]?.[1].isCancelled).toBe(true);
    expect(render).toHaveBeenLastCalledWith(
      { status: SEARCH_STATUS.idle },
      null,
    );
  });

  it.each([{ countries: [] }, { countries: [createCountry('Japan')] }])(
    'renders a completed search with %j',
    async ({ countries }: { countries: readonly Country[] }): Promise<void> => {
      const {
        controller,
        search,
        render,
      }: ReturnType<typeof createControllerSetup> = createControllerSetup();

      search.mockResolvedValue(countries);
      controller.updateSearchQuery('Japan');
      await vi.advanceTimersByTimeAsync(300);

      expect(render).toHaveBeenLastCalledWith(
        countries.length === 0
          ? { status: SEARCH_STATUS.empty, query: 'Japan' }
          : { status: SEARCH_STATUS.results, query: 'Japan', countries },
        null,
      );
    },
  );

  it('finishes a search even when optional history recording fails', async (): Promise<void> => {
    const {
      controller,
      search,
      render,
    }: ReturnType<typeof createControllerSetup> = createControllerSetup({
      recordQuery(): never {
        throw new Error('History unavailable');
      },
    });
    const countries: readonly Country[] = [createCountry('Japan')];

    search.mockResolvedValue(countries);
    controller.updateSearchQuery('Japan');
    await vi.advanceTimersByTimeAsync(300);

    expect(render).toHaveBeenLastCalledWith(
      { status: SEARCH_STATUS.results, query: 'Japan', countries },
      null,
    );
  });

  it.each([false, true])(
    'ignores stale success while the latest search has started: %s',
    async (hasLatestStarted: boolean): Promise<void> => {
      const {
        controller,
        search,
        render,
      }: ReturnType<typeof createControllerSetup> = createControllerSetup();
      const staleResponse: Deferred<readonly Country[]> = createDeferred();
      const latestResponse: Deferred<readonly Country[]> = createDeferred();
      const countries: readonly Country[] = [createCountry('Canada')];

      search
        .mockReturnValueOnce(staleResponse.promise)
        .mockReturnValueOnce(latestResponse.promise);

      controller.updateSearchQuery('Japan');
      await vi.advanceTimersByTimeAsync(300);
      controller.updateSearchQuery('Canada');
      if (hasLatestStarted) {
        await vi.advanceTimersByTimeAsync(300);
      }

      staleResponse.resolve([createCountry('Japan')]);
      await vi.advanceTimersByTimeAsync(0);

      expect(render).toHaveBeenLastCalledWith(
        {
          status: hasLatestStarted
            ? SEARCH_STATUS.loading
            : SEARCH_STATUS.waiting,
          query: 'Canada',
        },
        null,
      );

      await vi.advanceTimersByTimeAsync(300);
      latestResponse.resolve(countries);
      await vi.advanceTimersByTimeAsync(0);
      expect(render).toHaveBeenLastCalledWith(
        { status: SEARCH_STATUS.results, query: 'Canada', countries },
        null,
      );
    },
  );

  it('does not overwrite fresh results when an older response arrives last', async (): Promise<void> => {
    const {
      controller,
      search,
      render,
    }: ReturnType<typeof createControllerSetup> = createControllerSetup();
    const staleResponse: Deferred<readonly Country[]> = createDeferred();
    const countries: readonly Country[] = [createCountry('Spain')];

    search
      .mockReturnValueOnce(staleResponse.promise)
      .mockResolvedValueOnce(countries);

    controller.updateSearchQuery('sp');
    await vi.advanceTimersByTimeAsync(300);
    controller.updateSearchQuery('spain');
    await vi.advanceTimersByTimeAsync(300);
    expect(render).toHaveBeenLastCalledWith(
      { status: SEARCH_STATUS.results, query: 'spain', countries },
      null,
    );

    render.mockClear();
    staleResponse.resolve([createCountry('Stale country')]);
    await vi.advanceTimersByTimeAsync(0);

    expect(render).not.toHaveBeenCalled();
  });

  it('cancels active and scheduled work on destruction', async (): Promise<void> => {
    const {
      controller,
      search,
      render,
    }: ReturnType<typeof createControllerSetup> = createControllerSetup();
    const response: Deferred<readonly Country[]> = createDeferred();

    search.mockReturnValue(response.promise);
    controller.updateSearchQuery('Japan');
    await vi.advanceTimersByTimeAsync(300);
    controller.updateSearchQuery('Canada');
    controller.destroy();
    render.mockClear();
    response.resolve([createCountry('Japan')]);
    await vi.runAllTimersAsync();

    expect(search.mock.calls[0]?.[1].isCancelled).toBe(true);
    expect(search).toHaveBeenCalledTimes(1);
    expect(render).not.toHaveBeenCalled();
  });
});

describe('search failures and retry', (): void => {
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
    {
      error: new TypeError('Failed to fetch'),
      errorType: SEARCH_ERROR_TYPES.network,
      statusCode: null,
    },
  ])(
    'renders a classified $errorType failure',
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
        search,
        render,
      }: ReturnType<typeof createControllerSetup> = createControllerSetup();

      search.mockRejectedValue(error);
      controller.updateSearchQuery('sp');
      await vi.advanceTimersByTimeAsync(300);

      expect(render).toHaveBeenLastCalledWith(
        expect.objectContaining({
          status: SEARCH_STATUS.error,
          query: 'sp',
          errorType,
          statusCode,
        }),
        null,
      );
    },
  );

  it('never renders intentional cancellation as an error', async (): Promise<void> => {
    const {
      controller,
      search,
      render,
    }: ReturnType<typeof createControllerSetup> = createControllerSetup();

    search.mockRejectedValue({ name: 'AbortError' });
    controller.updateSearchQuery('sp');
    await vi.advanceTimersByTimeAsync(300);

    expect(
      render.mock.calls.some(
        ([state]: [SearchState, Country | null]): boolean =>
          state.status === SEARCH_STATUS.error,
      ),
    ).toBe(false);
  });

  it('retries the latest input immediately and cancels its pending debounce', async (): Promise<void> => {
    const {
      controller,
      search,
      render,
    }: ReturnType<typeof createControllerSetup> = createControllerSetup();
    const countries: readonly Country[] = [createCountry('Spain')];

    search
      .mockRejectedValueOnce(new TypeError('Offline'))
      .mockResolvedValue(countries);

    controller.updateSearchQuery('sp');
    await vi.advanceTimersByTimeAsync(300);
    controller.updateSearchQuery('spain');
    controller.retrySearch();
    await vi.advanceTimersByTimeAsync(0);

    expect(search).toHaveBeenLastCalledWith('spain', expect.anything());
    expect(render).toHaveBeenLastCalledWith(
      { status: SEARCH_STATUS.results, query: 'spain', countries },
      null,
    );

    await vi.advanceTimersByTimeAsync(300);
    expect(search).toHaveBeenCalledTimes(2);
  });

  it('cancels an active retry before starting the next one', async (): Promise<void> => {
    const { controller, search }: ReturnType<typeof createControllerSetup> =
      createControllerSetup();

    controller.updateSearchQuery('sp');
    controller.retrySearch();
    controller.retrySearch();
    await vi.runAllTimersAsync();

    expect(search.mock.calls[0]?.[1].isCancelled).toBe(true);
    expect(search).toHaveBeenCalledTimes(2);
  });

  it('clears an error and ignores retry after input becomes blank', async (): Promise<void> => {
    const {
      controller,
      search,
      render,
    }: ReturnType<typeof createControllerSetup> = createControllerSetup();

    search.mockRejectedValue(new TypeError('Offline'));
    controller.updateSearchQuery('sp');
    await vi.advanceTimersByTimeAsync(300);
    controller.updateSearchQuery(' ');
    controller.retrySearch();
    await vi.runAllTimersAsync();

    expect(render).toHaveBeenLastCalledWith(
      { status: SEARCH_STATUS.idle },
      null,
    );

    expect(search).toHaveBeenCalledTimes(1);
  });

  it.each([false, true])(
    'ignores stale failure while the latest search has started: %s',
    async (hasLatestStarted: boolean): Promise<void> => {
      const {
        controller,
        search,
        render,
      }: ReturnType<typeof createControllerSetup> = createControllerSetup();
      const staleResponse: Deferred<readonly Country[]> = createDeferred();

      const latestResponse: Deferred<readonly Country[]> = createDeferred();

      search
        .mockReturnValueOnce(staleResponse.promise)
        .mockReturnValueOnce(latestResponse.promise);

      controller.updateSearchQuery('sp');
      await vi.advanceTimersByTimeAsync(300);
      controller.updateSearchQuery('spain');
      if (hasLatestStarted) {
        controller.retrySearch();
      }

      staleResponse.reject(new HttpError(503));
      await vi.advanceTimersByTimeAsync(0);

      expect(render).toHaveBeenLastCalledWith(
        {
          status: hasLatestStarted
            ? SEARCH_STATUS.loading
            : SEARCH_STATUS.waiting,
          query: 'spain',
        },
        null,
      );

      latestResponse.resolve([]);
      controller.destroy();
      await vi.advanceTimersByTimeAsync(0);
    },
  );
});

describe('country selection', (): void => {
  const detailedCountry: Country = {
    ...createCountry('Israel'),
    id: 'ISR',
    capital: 'Jerusalem',
    region: 'Asia',
    population: 9216900,
    area: 20770,
    languages: ['Hebrew'],
    currencies: [{ code: 'ILS', name: 'Israeli new shekel', symbol: '₪' }],
    borders: ['EGY', 'JOR', 'LBN', 'SYR'],
    description: 'Israel is in Asia. Capital: Jerusalem.',
  };
  const partialCountry: Country = {
    ...createCountry('Example Island'),
    currencies: [{ code: null, name: 'Local currency', symbol: null }],
  };

  it.each([detailedCountry, partialCountry])(
    'opens $name without another search',
    async (country: Country): Promise<void> => {
      const {
        controller,
        search,
        render,
      }: ReturnType<typeof createControllerSetup> = createControllerSetup();
      const countries: readonly Country[] = [detailedCountry, partialCountry];

      search.mockResolvedValue(countries);
      controller.updateSearchQuery('country');
      await vi.advanceTimersByTimeAsync(300);
      controller.selectCountry(country.id);

      expect(render).toHaveBeenLastCalledWith(
        { status: SEARCH_STATUS.results, query: 'country', countries },
        country,
      );

      expect(search).toHaveBeenCalledTimes(1);
    },
  );

  it('closes and reopens details while keeping the search results', async (): Promise<void> => {
    const {
      controller,
      search,
      render,
    }: ReturnType<typeof createControllerSetup> = createControllerSetup();

    search.mockResolvedValue([detailedCountry]);
    controller.updateSearchQuery('Israel');
    await vi.advanceTimersByTimeAsync(300);
    controller.selectCountry('ISR');
    controller.closeCountryDetails();

    expect(render).toHaveBeenLastCalledWith(
      {
        status: SEARCH_STATUS.results,
        query: 'Israel',
        countries: [detailedCountry],
      },
      null,
    );

    controller.selectCountry('ISR');
    expect(render).toHaveBeenLastCalledWith(expect.anything(), detailedCountry);
    expect(search).toHaveBeenCalledTimes(1);
  });

  it.each(['Canada', ''])(
    'closes details when the query changes to %j',
    async (query: string): Promise<void> => {
      const {
        controller,
        search,
        render,
      }: ReturnType<typeof createControllerSetup> = createControllerSetup();

      search.mockResolvedValue([detailedCountry]);
      controller.updateSearchQuery('Israel');
      await vi.advanceTimersByTimeAsync(300);
      controller.selectCountry('ISR');
      controller.updateSearchQuery(query);
      controller.selectCountry('ISR');

      expect(render).toHaveBeenLastCalledWith(
        query === ''
          ? { status: SEARCH_STATUS.idle }
          : { status: SEARCH_STATUS.waiting, query },
        null,
      );
    },
  );

  it('selects only countries in the latest results', async (): Promise<void> => {
    const {
      controller,
      search,
      render,
    }: ReturnType<typeof createControllerSetup> = createControllerSetup();

    search
      .mockResolvedValueOnce([detailedCountry])
      .mockResolvedValueOnce([partialCountry]);

    controller.updateSearchQuery('Israel');
    await vi.advanceTimersByTimeAsync(300);
    controller.updateSearchQuery('Example');
    await vi.advanceTimersByTimeAsync(300);
    controller.selectCountry('ISR');
    expect(render).toHaveBeenLastCalledWith(expect.anything(), null);
    controller.selectCountry(partialCountry.id);
    expect(render).toHaveBeenLastCalledWith(expect.anything(), partialCountry);
    expect(search).toHaveBeenCalledTimes(2);
  });

  it('ignores selection before results exist', (): void => {
    const {
      controller,
      search,
      render,
    }: ReturnType<typeof createControllerSetup> = createControllerSetup();

    controller.selectCountry('unknown');
    controller.closeCountryDetails();

    expect(render).toHaveBeenLastCalledWith(
      { status: SEARCH_STATUS.idle },
      null,
    );

    expect(search).not.toHaveBeenCalled();
  });
});
