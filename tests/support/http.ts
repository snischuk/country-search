export function createJsonResponse(
  payload: unknown,
  statusCode: number = 200,
): Response {
  return new Response(JSON.stringify(payload), { status: statusCode });
}

export function getRequestSignal(options?: RequestInit): AbortSignal {
  if (!options?.signal) {
    throw new Error('Expected an HTTP request with an abort signal.');
  }

  return options.signal;
}

export function waitForAbort<T>(signal: AbortSignal): Promise<T> {
  return new Promise<T>(
    (
      _resolve: (value: T | PromiseLike<T>) => void,
      reject: (error: unknown) => void,
    ): void => {
      function rejectAbortedRequest(): void {
        const reason: unknown = signal.reason;

        reject(
          reason instanceof Error
            ? reason
            : new DOMException('Cancelled', 'AbortError'),
        );
      }

      if (signal.aborted) {
        rejectAbortedRequest();
      } else {
        signal.addEventListener('abort', rejectAbortedRequest, { once: true });
      }
    },
  );
}
