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
    const calls: string[] = [];
    const delayed: Debounced<[string]> = debounce((value: string): void => {
      calls.push(value);
    }, 300);

    delayed('Japan');
    vi.advanceTimersByTime(299);
    expect(calls).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(calls).toEqual(['Japan']);
  });

  it('restarts the delay after another call', (): void => {
    const calls: string[] = [];
    const delayed: Debounced<[string]> = debounce((value: string): void => {
      calls.push(value);
    }, 300);

    delayed('sp');
    vi.advanceTimersByTime(200);
    delayed('spain');
    vi.advanceTimersByTime(299);
    expect(calls).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(calls).toEqual(['spain']);
  });

  it('cancels pending work and can schedule again afterwards', (): void => {
    let calls: number = 0;
    const delayed: Debounced<[]> = debounce((): void => {
      calls += 1;
    }, 300);

    delayed();
    delayed.cancel();
    delayed.cancel();
    vi.advanceTimersByTime(1000);
    expect(calls).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
    delayed();
    vi.advanceTimersByTime(300);
    expect(calls).toBe(1);
  });

  it('keeps separate instances independent', (): void => {
    const calls: string[] = [];
    const first: Debounced<[]> = debounce((): void => {
      calls.push('first');
    }, 300);
    const second: Debounced<[]> = debounce((): void => {
      calls.push('second');
    }, 300);

    first();
    second();
    first.cancel();
    vi.advanceTimersByTime(300);
    expect(calls).toEqual(['second']);
  });
});
