import { describe, expect, it, vi } from 'vitest';
import type { Mock } from 'vitest';

import { createSearchCancellationSource } from '@/features/country-search/application/search-cancellation';
import type { SearchCancellationSource } from '@/features/country-search/application/search.port';

describe('search cancellation', (): void => {
  it('starts active and notifies subscribers only once', (): void => {
    const source: SearchCancellationSource = createSearchCancellationSource();
    const onCancel: Mock<() => void> = vi.fn();

    source.signal.onCancel(onCancel);
    expect(source.signal.isCancelled).toBe(false);
    expect(onCancel).not.toHaveBeenCalled();
    source.cancel();
    source.cancel();

    expect(source.signal.isCancelled).toBe(true);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('notifies all subscribers before reporting every callback failure', (): void => {
    const source: SearchCancellationSource = createSearchCancellationSource();
    const firstError: Error = new Error('First failure');
    const secondError: Error = new Error('Second failure');
    const onCancel: Mock<() => void> = vi.fn();

    source.signal.onCancel((): never => {
      throw firstError;
    });

    source.signal.onCancel(onCancel);
    source.signal.onCancel((): never => {
      throw secondError;
    });

    expect((): void => source.cancel()).toThrow(
      expect.objectContaining({ errors: [firstError, secondError] }),
    );

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(source.signal.isCancelled).toBe(true);
    expect((): void => source.cancel()).not.toThrow();
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('does not notify unsubscribed callbacks', (): void => {
    const source: SearchCancellationSource = createSearchCancellationSource();
    const onCancel: Mock<() => void> = vi.fn();
    const unsubscribe: () => void = source.signal.onCancel(onCancel);

    unsubscribe();
    unsubscribe();
    source.cancel();

    expect(onCancel).not.toHaveBeenCalled();
  });

  it('immediately notifies a subscriber registered after cancellation', (): void => {
    const source: SearchCancellationSource = createSearchCancellationSource();
    const onCancel: Mock<() => void> = vi.fn();

    source.cancel();
    const unsubscribe: () => void = source.signal.onCancel(onCancel);

    expect(onCancel).toHaveBeenCalledTimes(1);
    unsubscribe();
    source.cancel();
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
