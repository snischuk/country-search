import type { SearchCancellationSource } from '@/features/country-search/application/search.port';

export function createSearchCancellationSource(): SearchCancellationSource {
  let isCancelled: boolean = false;
  const cancellationCallbacks: Set<() => void> = new Set();

  const signal: SearchCancellationSource['signal'] = {
    get isCancelled(): boolean {
      return isCancelled;
    },

    onCancel(callback: () => void): () => void {
      if (isCancelled) {
        callback();

        return (): void => {};
      }

      cancellationCallbacks.add(callback);

      return (): void => {
        cancellationCallbacks.delete(callback);
      };
    },
  };

  return {
    signal,
    cancel(): void {
      if (isCancelled) {
        return;
      }

      isCancelled = true;
      const registeredCallbacks: (() => void)[] = [...cancellationCallbacks];
      const callbackErrors: unknown[] = [];

      cancellationCallbacks.clear();
      registeredCallbacks.forEach((callback: () => void): void => {
        try {
          callback();
        } catch (error: unknown) {
          callbackErrors.push(error);
        }
      });

      if (callbackErrors.length > 0) {
        throw new AggregateError(
          callbackErrors,
          'Cancellation callbacks failed',
        );
      }
    },
  };
}
