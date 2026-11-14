import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { debounce } from '@/features/country-search/infrastructure/scheduling/debounce';
import type {
  Debounced,
  TimerDriver,
} from '@/features/country-search/infrastructure/scheduling/debounce';

const TIMER_DRIVER: TimerDriver<ReturnType<typeof setTimeout>> = {
  scheduleTimeout(
    callback: () => void,
    delayMilliseconds: number,
  ): ReturnType<typeof setTimeout> {
    return setTimeout(callback, delayMilliseconds);
  },

  cancelTimeout(timerId: ReturnType<typeof setTimeout>): void {
    clearTimeout(timerId);
  },
};

beforeEach((): void => {
  vi.useFakeTimers();
});

afterEach((): void => {
  vi.useRealTimers();
});

describe('debounce', (): void => {
  it('waits for the whole delay and preserves the latest arguments', (): void => {
    const receivedQueries: string[] = [];
    const scheduleTimeout: ReturnType<typeof vi.spyOn> = vi.spyOn(
      TIMER_DRIVER,
      'scheduleTimeout',
    );
    const debouncedCallback: Debounced<[string]> = debounce(
      (query: string): void => {
        receivedQueries.push(query);
      },
      300,
      TIMER_DRIVER,
    );

    debouncedCallback('Japan');

    expect(scheduleTimeout).toHaveBeenCalledOnce();
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
      TIMER_DRIVER,
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
    const debouncedCallback: Debounced<[]> = debounce(
      (): void => {
        callbackCallCount += 1;
      },
      300,
      TIMER_DRIVER,
    );

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
    const firstDebouncedCallback: Debounced<[]> = debounce(
      (): void => {
        invokedCallbacks.push('first');
      },
      300,
      TIMER_DRIVER,
    );
    const secondDebouncedCallback: Debounced<[]> = debounce(
      (): void => {
        invokedCallbacks.push('second');
      },
      300,
      TIMER_DRIVER,
    );

    firstDebouncedCallback();
    secondDebouncedCallback();
    firstDebouncedCallback.cancel();
    vi.advanceTimersByTime(300);
    expect(invokedCallbacks).toEqual(['second']);
  });
});
