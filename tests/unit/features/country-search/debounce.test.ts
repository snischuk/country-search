import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Mock } from 'vitest';

import { debounce } from '@/features/country-search/infrastructure/scheduling/debounce';
import type {
  Debounced,
  TimerDriver,
} from '@/features/country-search/infrastructure/scheduling/debounce';

const timerDriver: TimerDriver<ReturnType<typeof setTimeout>> = {
  scheduleTimeout(
    callback: () => void,
    delayMilliseconds: number,
  ): ReturnType<typeof setTimeout> {
    return setTimeout(callback, delayMilliseconds);
  },
  cancelTimeout(timerHandle: ReturnType<typeof setTimeout>): void {
    clearTimeout(timerHandle);
  },
};

beforeEach((): void => {
  vi.useFakeTimers();
});

afterEach((): void => {
  vi.clearAllTimers();
  vi.useRealTimers();
});

describe('debounce', (): void => {
  it('supports the two-argument task contract without a supplied timer driver', (): void => {
    const onSearch: Mock<(query: string) => void> = vi.fn();
    const delayedSearch: Debounced<[string]> = debounce(onSearch, 300);

    delayedSearch('sp');
    vi.advanceTimersByTime(200);
    delayedSearch('spain');
    vi.advanceTimersByTime(299);
    expect(onSearch).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onSearch).toHaveBeenCalledExactlyOnceWith('spain');
    delayedSearch('Japan');
    delayedSearch.cancel();
    vi.runAllTimers();
    expect(onSearch).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('waits for the entire delay before passing arguments to the callback', (): void => {
    const onSearch: Mock<(query: string, page: number) => void> = vi.fn();
    const delayedSearch: Debounced<[string, number]> = debounce(
      onSearch,
      300,
      timerDriver,
    );

    delayedSearch('Japan', 2);
    vi.advanceTimersByTime(299);
    expect(onSearch).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onSearch).toHaveBeenCalledExactlyOnceWith('Japan', 2);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('resets the timer and retains only the latest arguments', (): void => {
    const onSearch: Mock<(query: string) => void> = vi.fn();
    const delayedSearch: Debounced<[string]> = debounce(
      onSearch,
      300,
      timerDriver,
    );

    delayedSearch('sp');
    vi.advanceTimersByTime(200);
    delayedSearch('spain');
    expect(vi.getTimerCount()).toBe(1);
    vi.advanceTimersByTime(299);
    expect(onSearch).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onSearch).toHaveBeenCalledExactlyOnceWith('spain');
  });

  it('allows repeated cancellation and can schedule again', (): void => {
    const onSearch: Mock<() => void> = vi.fn();
    const delayedSearch: Debounced<[]> = debounce(onSearch, 300, timerDriver);

    delayedSearch.cancel();
    delayedSearch();
    delayedSearch.cancel();
    delayedSearch.cancel();
    vi.advanceTimersByTime(1000);
    expect(onSearch).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
    delayedSearch();
    vi.advanceTimersByTime(300);
    expect(onSearch).toHaveBeenCalledTimes(1);
  });

  it('keeps separate debounce instances independent', (): void => {
    const onFirstSearch: Mock<() => void> = vi.fn();
    const onSecondSearch: Mock<() => void> = vi.fn();
    const first: Debounced<[]> = debounce(onFirstSearch, 300, timerDriver);
    const second: Debounced<[]> = debounce(onSecondSearch, 300, timerDriver);

    first();
    second();
    first.cancel();
    vi.advanceTimersByTime(300);

    expect(onFirstSearch).not.toHaveBeenCalled();
    expect(onSecondSearch).toHaveBeenCalledTimes(1);
  });
});
