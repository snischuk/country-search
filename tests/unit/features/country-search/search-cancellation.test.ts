import { describe, expect, it, vi } from 'vitest';
import type { Mock } from 'vitest';

import { createSearchCancellationSource } from '@/features/country-search/application/search-cancellation';
import type { SearchCancellationSource } from '@/features/country-search/application/search.port';

describe('createSearchCancellationSource', (): void => {
  it('notifies every subscriber before reporting callback failures', (): void => {
    const source: SearchCancellationSource = createSearchCancellationSource();
    const callbackError: Error = new Error('Callback failed');
    const remainingCallback: Mock<() => void> = vi.fn();

    source.signal.onCancel((): never => {
      throw callbackError;
    });

    source.signal.onCancel(remainingCallback);

    expect((): void => source.cancel()).toThrow(AggregateError);
    expect(remainingCallback).toHaveBeenCalledExactlyOnceWith();
    expect(source.signal.isCancelled).toBe(true);
    expect((): void => source.cancel()).not.toThrow();
    expect(remainingCallback).toHaveBeenCalledTimes(1);
  });

  it('includes every callback failure in the reported error', (): void => {
    const source: SearchCancellationSource = createSearchCancellationSource();
    const firstError: Error = new Error('First failure');
    const secondError: Error = new Error('Second failure');

    source.signal.onCancel((): never => {
      throw firstError;
    });

    source.signal.onCancel((): never => {
      throw secondError;
    });

    expect((): void => source.cancel()).toThrow(
      expect.objectContaining({ errors: [firstError, secondError] }),
    );
  });

  it('preserves unsubscription and immediate notification after cancellation', (): void => {
    const source: SearchCancellationSource = createSearchCancellationSource();
    const unsubscribedCallback: Mock<() => void> = vi.fn();
    const lateCallback: Mock<() => void> = vi.fn();
    const unsubscribe: () => void =
      source.signal.onCancel(unsubscribedCallback);

    unsubscribe();
    source.cancel();
    source.signal.onCancel(lateCallback);
    source.cancel();

    expect(unsubscribedCallback).not.toHaveBeenCalled();
    expect(lateCallback).toHaveBeenCalledExactlyOnceWith();
  });
});
