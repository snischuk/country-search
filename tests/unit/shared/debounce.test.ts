import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { debounce } from '@/shared/utils/debounce';
import type { Debounced } from '@/shared/utils/debounce';

beforeEach((): void => {
  vi.useFakeTimers();
});

afterEach((): void => {
  vi.useRealTimers();
});

describe('debounce', (): void => {
  it('waits for the whole delay and preserves the latest arguments', (): void => {
    const receivedQueries: string[] = [];
    const debouncedCallback: Debounced<[string]> = debounce(
      (query: string): void => {
        receivedQueries.push(query);
      },
      300,
    );

    debouncedCallback('Japan');
    vi.advanceTimersByTime(299);
    expect(receivedQueries).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(receivedQueries).toEqual(['Japan']);
  });

  it('restarts the delay after another call', (): void => {
    const receivedQueries: string[] = [];
    const debouncedCallback: Debounced<[string]> = debounce(
      (query: string): void => {
        receivedQueries.push(query);
      },
      300,
    );

    debouncedCallback('sp');
    vi.advanceTimersByTime(200);
    debouncedCallback('spain');
    vi.advanceTimersByTime(299);
    expect(receivedQueries).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(receivedQueries).toEqual(['spain']);
  });

  it('cancels pending work and can schedule again afterwards', (): void => {
    let callbackCallCount: number = 0;
    const debouncedCallback: Debounced<[]> = debounce((): void => {
      callbackCallCount += 1;
    }, 300);

    debouncedCallback();
    debouncedCallback.cancel();
    debouncedCallback.cancel();
    vi.advanceTimersByTime(1000);
    expect(callbackCallCount).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
    debouncedCallback();
    vi.advanceTimersByTime(300);
    expect(callbackCallCount).toBe(1);
  });

  it('keeps separate instances independent', (): void => {
    const invokedCallbacks: string[] = [];
    const firstDebouncedCallback: Debounced<[]> = debounce((): void => {
      invokedCallbacks.push('first');
    }, 300);
    const secondDebouncedCallback: Debounced<[]> = debounce((): void => {
      invokedCallbacks.push('second');
    }, 300);

    firstDebouncedCallback();
    secondDebouncedCallback();
    firstDebouncedCallback.cancel();
    vi.advanceTimersByTime(300);
    expect(invokedCallbacks).toEqual(['second']);
  });
});
