import type { SearchCancellationSource } from './search.port';

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

      cancellationCallbacks.forEach((callback: () => void): void => {
        callback();
      });

      cancellationCallbacks.clear();
    },
  };
}
