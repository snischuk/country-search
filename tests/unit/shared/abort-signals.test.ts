import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createAbortSignalWithTimeout } from '@/shared/utils/abort-signals';

const REQUEST_TIMEOUT_MS: number = 10_000;
const BEFORE_TIMEOUT_MS: number = REQUEST_TIMEOUT_MS - 1;

beforeEach((): void => {
  vi.useFakeTimers();
});

afterEach((): void => {
  vi.useRealTimers();
});

describe('createAbortSignalWithTimeout', (): void => {
  it('aborts with the caller reason when the caller cancels', (): void => {
    const callerController: AbortController = new AbortController();

    const { signal, cleanup }: ReturnType<typeof createAbortSignalWithTimeout> =
      createAbortSignalWithTimeout(callerController.signal, REQUEST_TIMEOUT_MS);

    const abortReason: DOMException = new DOMException(
      'Request cancelled',
      'AbortError',
    );

    callerController.abort(abortReason);

    expect(signal.aborted).toBe(true);
    expect(signal.reason).toBe(abortReason);
    cleanup();
  });

  it('aborts with TimeoutError at the ten second deadline', (): void => {
    const callerController: AbortController = new AbortController();

    const { signal, cleanup }: ReturnType<typeof createAbortSignalWithTimeout> =
      createAbortSignalWithTimeout(callerController.signal, REQUEST_TIMEOUT_MS);

    vi.advanceTimersByTime(BEFORE_TIMEOUT_MS);

    expect(signal.aborted).toBe(false);

    vi.advanceTimersByTime(1);

    expect(signal.aborted).toBe(true);
    expect(signal.reason).toMatchObject({ name: 'TimeoutError' });
    cleanup();
  });

  it('preserves the caller reason when the caller signal is already aborted', (): void => {
    const callerController: AbortController = new AbortController();

    const abortReason: DOMException = new DOMException(
      'Request cancelled before start',
      'AbortError',
    );

    callerController.abort(abortReason);

    const { signal, cleanup }: ReturnType<typeof createAbortSignalWithTimeout> =
      createAbortSignalWithTimeout(callerController.signal, REQUEST_TIMEOUT_MS);

    expect(signal.aborted).toBe(true);
    expect(signal.reason).toBe(abortReason);
    expect(vi.getTimerCount()).toBe(0);
    cleanup();
  });

  it('keeps the first abort reason and ignores the later deadline', (): void => {
    const callerController: AbortController = new AbortController();

    const abortReason: DOMException = new DOMException(
      'Request cancelled',
      'AbortError',
    );

    const { signal, cleanup }: ReturnType<typeof createAbortSignalWithTimeout> =
      createAbortSignalWithTimeout(callerController.signal, REQUEST_TIMEOUT_MS);

    callerController.abort(abortReason);

    vi.advanceTimersByTime(REQUEST_TIMEOUT_MS);

    expect(signal.reason).toBe(abortReason);
    expect(vi.getTimerCount()).toBe(0);
    cleanup();
  });

  it('clears the deadline and caller listener when cleanup runs', (): void => {
    const callerController: AbortController = new AbortController();

    const removeEventListener: ReturnType<typeof vi.spyOn> = vi.spyOn(
      callerController.signal,
      'removeEventListener',
    );

    const { signal, cleanup }: ReturnType<typeof createAbortSignalWithTimeout> =
      createAbortSignalWithTimeout(callerController.signal, REQUEST_TIMEOUT_MS);

    cleanup();

    vi.advanceTimersByTime(REQUEST_TIMEOUT_MS);

    expect(signal.aborted).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
    expect(removeEventListener).toHaveBeenCalledWith(
      'abort',
      expect.any(Function),
    );
  });

  it('keeps AbortError and TimeoutError distinguishable', (): void => {
    const callerController: AbortController = new AbortController();

    const callerAbort: ReturnType<typeof createAbortSignalWithTimeout> =
      createAbortSignalWithTimeout(callerController.signal, REQUEST_TIMEOUT_MS);

    callerController.abort();

    const timeoutController: AbortController = new AbortController();

    const timeoutAbort: ReturnType<typeof createAbortSignalWithTimeout> =
      createAbortSignalWithTimeout(
        timeoutController.signal,
        REQUEST_TIMEOUT_MS,
      );

    vi.advanceTimersByTime(REQUEST_TIMEOUT_MS);

    expect(callerAbort.signal.reason).toMatchObject({ name: 'AbortError' });
    expect(timeoutAbort.signal.reason).toMatchObject({
      name: 'TimeoutError',
    });

    callerAbort.cleanup();
    timeoutAbort.cleanup();
  });
});
