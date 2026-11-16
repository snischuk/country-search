import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Mock } from 'vitest';

import {
  HttpError,
  ValidationError,
} from '@/features/country-search/application/search-errors';
import type { Country } from '@/features/country-search/domain/country.type';
import { searchCountries } from '@/features/country-search/infrastructure/http/search-countries.adapter';

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

describe('searchCountries HTTP contract', (): void => {
  it('trims and encodes the query and supplies a fetch signal', async (): Promise<void> => {
    const fetchRequest: Mock<typeof fetch> = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(createJsonResponse([]));

    await expect(
      searchCountries('  New Zealand / South  ', new AbortController().signal),
    ).resolves.toEqual([]);

    expect(fetchRequest).toHaveBeenCalledExactlyOnceWith(
      'https://countries.dev/name/New%20Zealand%20%2F%20South',
      expect.objectContaining({ method: 'GET' }),
    );

    expect(fetchRequest.mock.calls[0]?.[1]?.signal).toBeInstanceOf(AbortSignal);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('maps successful JSON into countries', async (): Promise<void> => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      createJsonResponse([
        { name: ' Japan ', alpha3Code: 'JPN', capital: ' Tokyo ' },
      ]),
    );

    await expect(
      searchCountries('Japan', new AbortController().signal),
    ).resolves.toMatchObject([{ id: 'JPN', name: 'Japan', capital: 'Tokyo' }]);
  });

  it('returns no matches without fetching blank input', async (): Promise<void> => {
    const fetchRequest: Mock<typeof fetch> = vi.spyOn(globalThis, 'fetch');

    await expect(
      searchCountries(' ', new AbortController().signal),
    ).resolves.toEqual([]);

    expect(fetchRequest).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('rejects an already cancelled caller without fetching', async (): Promise<void> => {
    const fetchRequest: Mock<typeof fetch> = vi.spyOn(globalThis, 'fetch');
    const cancellation: AbortController = new AbortController();

    cancellation.abort();
    await expect(
      searchCountries('Japan', cancellation.signal),
    ).rejects.toMatchObject({ name: 'AbortError' });

    expect(fetchRequest).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('returns no matches for 404 even with a malformed response body', async (): Promise<void> => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('not JSON', { status: 404 }),
    );

    await expect(
      searchCountries('missing', new AbortController().signal),
    ).resolves.toEqual([]);
  });

  it.each([400, 401, 429, 500, 503])(
    'throws HttpError with status %i before parsing the body',
    async (statusCode: number): Promise<void> => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response('not JSON', { status: statusCode }),
      );

      const request: Promise<readonly Country[]> = searchCountries(
        'Japan',
        new AbortController().signal,
      );

      await expect(request).rejects.toBeInstanceOf(HttpError);
      await expect(request).rejects.toMatchObject({ statusCode });
    },
  );

  it.each(['{', '{}', '[{"capital":"Tokyo"}]'])(
    'rejects malformed country responses: %s',
    async (body: string): Promise<void> => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(body));

      await expect(
        searchCountries('Japan', new AbortController().signal),
      ).rejects.toBeInstanceOf(ValidationError);
    },
  );

  it('preserves fetch network failures', async (): Promise<void> => {
    const networkError: TypeError = new TypeError('Offline');

    vi.spyOn(globalThis, 'fetch').mockRejectedValue(networkError);

    await expect(
      searchCountries('Japan', new AbortController().signal),
    ).rejects.toBe(networkError);

    expect(vi.getTimerCount()).toBe(0);
  });

  it('preserves a network failure while reading the response body', async (): Promise<void> => {
    const response: Response = new Response();
    const networkError: TypeError = new TypeError('Connection lost');

    vi.spyOn(response, 'json').mockRejectedValue(networkError);
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(response);

    await expect(
      searchCountries('Japan', new AbortController().signal),
    ).rejects.toBe(networkError);
  });
});

describe('searchCountries cancellation and deadline', (): void => {
  it('aborts a pending fetch when the caller cancels', async (): Promise<void> => {
    const cancellation: AbortController = new AbortController();
    const fetchRequest: Mock<typeof fetch> = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(
        (_input: RequestInfo | URL, options?: RequestInit): Promise<Response> =>
          waitForAbort(getRequestSignal(options)),
      );
    const request: Promise<readonly Country[]> = searchCountries(
      'Japan',
      cancellation.signal,
    );

    cancellation.abort();

    await expect(request).rejects.toMatchObject({ name: 'AbortError' });
    expect(fetchRequest.mock.calls[0]?.[1]?.signal?.aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each(['fetch', 'body'])(
    'reports TimeoutError when %s stalls for ten seconds',
    async (phase: string): Promise<void> => {
      const cancellation: AbortController = new AbortController();
      const fetchRequest: Mock<typeof fetch> = vi
        .spyOn(globalThis, 'fetch')
        .mockImplementation(
          (
            _input: RequestInfo | URL,
            options?: RequestInit,
          ): Promise<Response> => {
            const signal: AbortSignal = getRequestSignal(options);

            if (phase === 'fetch') {
              return waitForAbort(signal);
            }

            const response: Response = new Response();

            vi.spyOn(response, 'json').mockImplementation(
              (): Promise<unknown> => waitForAbort(signal),
            );

            return Promise.resolve(response);
          },
        );
      const request: Promise<readonly Country[]> = searchCountries(
        'Japan',
        cancellation.signal,
      );
      const timeoutAssertion: Promise<void> = expect(
        request,
      ).rejects.toMatchObject({ name: 'TimeoutError' });

      await vi.advanceTimersByTimeAsync(9999);
      expect(fetchRequest.mock.calls[0]?.[1]?.signal?.aborted).toBe(false);
      await vi.advanceTimersByTimeAsync(1);
      await timeoutAssertion;
      expect(fetchRequest.mock.calls[0]?.[1]?.signal?.aborted).toBe(true);
      expect(cancellation.signal.aborted).toBe(false);
      expect(vi.getTimerCount()).toBe(0);
    },
  );
});
