import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Mock } from 'vitest';

import { createSearchCancellationSource } from '@/features/country-search/application/search-cancellation';
import type {
  SearchCancellationSignal,
  SearchCancellationSource,
  SearchPort,
} from '@/features/country-search/application/search.port';
import type { Country } from '@/features/country-search/domain/country.type';
import { createSearchCountriesAdapter } from '@/features/country-search/infrastructure/http/country-search.adapter';

import {
  createJsonResponse,
  getRequestSignal,
  waitForAbort,
} from '../../../support/http';

beforeEach((): void => {
  vi.useFakeTimers();
});

afterEach((): void => {
  vi.clearAllTimers();
  vi.useRealTimers();
});

describe('search cancellation adapter', (): void => {
  it('converts application cancellation into an aborted fetch', async (): Promise<void> => {
    const fetchRequest: Mock<typeof fetch> = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(
        (_input: RequestInfo | URL, options?: RequestInit): Promise<Response> =>
          waitForAbort(getRequestSignal(options)),
      );
    const source: SearchCancellationSource = createSearchCancellationSource();
    const adapter: SearchPort = createSearchCountriesAdapter();
    const request: Promise<readonly Country[]> = adapter.search(
      'Japan',
      source.signal,
    );

    source.cancel();

    await expect(request).rejects.toMatchObject({ name: 'AbortError' });
    expect(fetchRequest.mock.calls[0]?.[1]?.signal?.aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('does not fetch for an already cancelled caller', async (): Promise<void> => {
    const fetchRequest: Mock<typeof fetch> = vi.spyOn(globalThis, 'fetch');
    const source: SearchCancellationSource = createSearchCancellationSource();

    source.cancel();

    await expect(
      createSearchCountriesAdapter().search('Japan', source.signal),
    ).rejects.toMatchObject({ name: 'AbortError' });

    expect(fetchRequest).not.toHaveBeenCalled();
  });

  it.each([false, true])(
    'releases the application subscription after HTTP failure: %s',
    async (shouldFail: boolean): Promise<void> => {
      const fetchRequest: Mock<typeof fetch> = vi
        .spyOn(globalThis, 'fetch')
        .mockResolvedValue(createJsonResponse([{ name: 'Japan' }]));
      const unsubscribe: Mock<() => void> = vi.fn();
      const signal: SearchCancellationSignal = {
        isCancelled: false,
        onCancel: vi
          .fn<SearchCancellationSignal['onCancel']>()
          .mockReturnValue(unsubscribe),
      };
      const error: TypeError = new TypeError('Offline');

      if (shouldFail) {
        fetchRequest.mockRejectedValue(error);
      }

      const request: Promise<readonly Country[]> =
        createSearchCountriesAdapter().search('Japan', signal);

      if (shouldFail) {
        await expect(request).rejects.toBe(error);
      } else {
        await expect(request).resolves.toMatchObject([{ name: 'Japan' }]);
      }

      expect(unsubscribe).toHaveBeenCalledTimes(1);
      expect(vi.getTimerCount()).toBe(0);
    },
  );
});
