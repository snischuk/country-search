export function createAbortSignalWithTimeout(
  callerSignal: AbortSignal,
  timeoutMilliseconds: number,
): {
  signal: AbortSignal;
  cleanup: () => void;
} {
  const controller: AbortController = new AbortController();
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const clearResources = (): void => {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }

    callerSignal.removeEventListener('abort', abortFromCaller);
  };

  const abortFromCaller = (): void => {
    if (!controller.signal.aborted) {
      controller.abort(callerSignal.reason);
    }

    clearResources();
  };

  if (callerSignal.aborted) {
    controller.abort(callerSignal.reason);
  } else {
    callerSignal.addEventListener('abort', abortFromCaller, { once: true });
    timeoutId = setTimeout((): void => {
      controller.abort(
        new DOMException('The operation timed out.', 'TimeoutError'),
      );

      clearResources();
    }, timeoutMilliseconds);
  }

  return { signal: controller.signal, cleanup: clearResources };
}
