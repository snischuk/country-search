import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createAbortSignalWithTimeout } from '@/features/country-search/infrastructure/http/abort-signal.adapter';

beforeEach((): void => {
  vi.useFakeTimers();
});

afterEach((): void => {
  vi.clearAllTimers();
  vi.useRealTimers();
});

describe('abort signal with deadline', (): void => {
  it.each([25, 1000, 10_000])(
    'aborts exactly at the supplied %i ms deadline',
    (delayMilliseconds: number): void => {
      const caller: AbortController = new AbortController();
      const {
        signal,
        cleanup,
      }: ReturnType<typeof createAbortSignalWithTimeout> =
        createAbortSignalWithTimeout(caller.signal, delayMilliseconds);

      vi.advanceTimersByTime(delayMilliseconds - 1);
      expect(signal.aborted).toBe(false);
      vi.advanceTimersByTime(1);
      expect(signal.reason).toMatchObject({ name: 'TimeoutError' });
      expect(caller.signal.aborted).toBe(false);
      cleanup();
    },
  );

  it.each([false, true])(
    'preserves the caller reason (cancelled before creation: %s)',
    (isAlreadyAborted: boolean): void => {
      const caller: AbortController = new AbortController();
      const reason: DOMException = new DOMException('Cancelled', 'AbortError');

      if (isAlreadyAborted) {
        caller.abort(reason);
      }

      const {
        signal,
        cleanup,
      }: ReturnType<typeof createAbortSignalWithTimeout> =
        createAbortSignalWithTimeout(caller.signal, 1000);

      if (!isAlreadyAborted) {
        caller.abort(reason);
      }

      expect(signal.aborted).toBe(true);
      expect(signal.reason).toBe(reason);
      expect(vi.getTimerCount()).toBe(0);
      cleanup();
    },
  );

  it('does not replace caller cancellation with a later timeout', (): void => {
    const caller: AbortController = new AbortController();
    const { signal, cleanup }: ReturnType<typeof createAbortSignalWithTimeout> =
      createAbortSignalWithTimeout(caller.signal, 1000);

    caller.abort();
    vi.advanceTimersByTime(1000);

    expect(signal.reason).toMatchObject({ name: 'AbortError' });
    expect(vi.getTimerCount()).toBe(0);
    cleanup();
  });

  it('does not replace a timeout with later caller cancellation', (): void => {
    const caller: AbortController = new AbortController();
    const { signal, cleanup }: ReturnType<typeof createAbortSignalWithTimeout> =
      createAbortSignalWithTimeout(caller.signal, 1000);

    vi.advanceTimersByTime(1000);
    caller.abort();

    expect(signal.reason).toMatchObject({ name: 'TimeoutError' });
    cleanup();
  });

  it('cleanup disconnects both the timer and caller signal', (): void => {
    const caller: AbortController = new AbortController();
    const { signal, cleanup }: ReturnType<typeof createAbortSignalWithTimeout> =
      createAbortSignalWithTimeout(caller.signal, 1000);

    cleanup();
    cleanup();
    caller.abort();
    vi.advanceTimersByTime(1000);

    expect(signal.aborted).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });
});
