import { describe, expect, it, vi } from 'vitest';
import type { Mock } from 'vitest';

import { createHistoryService } from '@/services/search-history/application/history-service';
import type { HistoryStorage } from '@/services/search-history/application/history-storage.port';

function createStorage(queries: readonly string[] = []): {
  load(): readonly string[];
  save: Mock<HistoryStorage['save']>;
} {
  return {
    load: (): readonly string[] => queries,
    save: vi.fn<HistoryStorage['save']>(),
  };
}

describe('history service', (): void => {
  it('normalizes saved history on creation', (): void => {
    const service: ReturnType<typeof createHistoryService> =
      createHistoryService(createStorage([' Japan ', '', 'Canada', 'Japan']));

    expect(service.getRecentQueries()).toEqual(['Japan', 'Canada']);
  });

  it('records normalized queries in memory and persists the same snapshot', (): void => {
    const storage: ReturnType<typeof createStorage> = createStorage();
    const service: ReturnType<typeof createHistoryService> =
      createHistoryService(storage);

    service.recordQuery(' Japan ');

    expect(service.getRecentQueries()).toEqual(['Japan']);
    expect(storage.save).toHaveBeenCalledExactlyOnceWith(['Japan']);
  });

  it('publishes each updated snapshot to subscribers', (): void => {
    const service: ReturnType<typeof createHistoryService> =
      createHistoryService(createStorage());
    const onHistoryChange: Mock<(queries: readonly string[]) => void> = vi.fn();

    service.subscribe(onHistoryChange);
    service.recordQuery('Japan');
    service.recordQuery('Canada');

    expect(onHistoryChange.mock.calls).toEqual([
      [['Japan']],
      [['Canada', 'Japan']],
    ]);
  });

  it('stops notification after unsubscription', (): void => {
    const service: ReturnType<typeof createHistoryService> =
      createHistoryService(createStorage());
    const onHistoryChange: Mock<(queries: readonly string[]) => void> = vi.fn();
    const unsubscribe: () => void = service.subscribe(onHistoryChange);

    unsubscribe();
    service.recordQuery('Japan');

    expect(onHistoryChange).not.toHaveBeenCalled();
  });

  it('does not mutate previously returned snapshots', (): void => {
    const service: ReturnType<typeof createHistoryService> =
      createHistoryService(createStorage());

    service.recordQuery('Japan');
    const earlierQueries: readonly string[] = service.getRecentQueries();

    service.recordQuery('Canada');

    expect(earlierQueries).toEqual(['Japan']);
    expect(service.getRecentQueries()).toEqual(['Canada', 'Japan']);
  });

  it('does not persist or publish blank input', (): void => {
    const storage: ReturnType<typeof createStorage> = createStorage(['Japan']);
    const service: ReturnType<typeof createHistoryService> =
      createHistoryService(storage);
    const onHistoryChange: Mock<(queries: readonly string[]) => void> = vi.fn();

    service.subscribe(onHistoryChange);
    service.recordQuery(' ');

    expect(service.getRecentQueries()).toEqual(['Japan']);
    expect(storage.save).not.toHaveBeenCalled();
    expect(onHistoryChange).not.toHaveBeenCalled();
  });

  it('starts empty when initial storage access fails', (): void => {
    const storage: ReturnType<typeof createStorage> = createStorage();

    vi.spyOn(storage, 'load').mockImplementation((): never => {
      throw new Error('Storage denied');
    });

    const service: ReturnType<typeof createHistoryService> =
      createHistoryService(storage);

    expect(service.getRecentQueries()).toEqual([]);
    service.recordQuery('Japan');
    expect(service.getRecentQueries()).toEqual(['Japan']);
  });

  it('keeps history and notifications working when saving fails', (): void => {
    const storage: ReturnType<typeof createStorage> = createStorage();
    const service: ReturnType<typeof createHistoryService> =
      createHistoryService(storage);
    const onHistoryChange: Mock<(queries: readonly string[]) => void> = vi.fn();

    vi.spyOn(storage, 'save').mockImplementation((): never => {
      throw new Error('Storage denied');
    });

    service.subscribe(onHistoryChange);
    service.recordQuery('Japan');

    expect(service.getRecentQueries()).toEqual(['Japan']);
    expect(onHistoryChange).toHaveBeenCalledExactlyOnceWith(['Japan']);
  });

  it('notifies all subscribers and persists history before reporting callback failures', (): void => {
    const storage: ReturnType<typeof createStorage> = createStorage();
    const service: ReturnType<typeof createHistoryService> =
      createHistoryService(storage);
    const firstError: Error = new Error('First subscriber failed');
    const secondError: Error = new Error('Second subscriber failed');
    const onHistoryChange: Mock<(queries: readonly string[]) => void> = vi.fn();

    service.subscribe((): never => {
      throw firstError;
    });

    service.subscribe(onHistoryChange);
    service.subscribe((): never => {
      throw secondError;
    });

    expect((): void => service.recordQuery('Japan')).toThrow(
      expect.objectContaining({ errors: [firstError, secondError] }),
    );

    expect(onHistoryChange).toHaveBeenCalledExactlyOnceWith(['Japan']);
    expect(service.getRecentQueries()).toEqual(['Japan']);
    expect(storage.save).toHaveBeenCalledExactlyOnceWith(['Japan']);
  });
});
