import { describe, expect, it, vi } from 'vitest';

import { createHistoryService } from '@/services/search-history/application/history-service';
import type { HistoryStorage } from '@/services/search-history/application/history-storage.port';

function createMemoryStorage(
  initialQueries: readonly string[] = [],
): HistoryStorage {
  let savedQueries: readonly string[] = initialQueries;

  return {
    load: (): readonly string[] => savedQueries,
    save: (queries: readonly string[]): void => {
      savedQueries = queries;
    },
  };
}

describe('createHistoryService', (): void => {
  it('loads and normalizes stored queries when created', (): void => {
    const service: ReturnType<typeof createHistoryService> =
      createHistoryService(
        createMemoryStorage([' Japan ', '', 'Canada', 'Japan']),
      );

    expect(service.getRecentQueries()).toEqual(['Japan', 'Canada']);
  });

  it('records and reads a query through the service', (): void => {
    const service: ReturnType<typeof createHistoryService> =
      createHistoryService(createMemoryStorage());

    service.recordQuery(' Japan ');

    expect(service.getRecentQueries()).toEqual(['Japan']);
  });

  it('notifies subscribers with the updated snapshot', (): void => {
    const service: ReturnType<typeof createHistoryService> =
      createHistoryService(createMemoryStorage());
    const onHistoryChange: ReturnType<typeof vi.fn> = vi.fn();

    service.subscribe(onHistoryChange);
    service.recordQuery('Japan');

    expect(onHistoryChange).toHaveBeenCalledOnce();
    expect(onHistoryChange).toHaveBeenCalledWith(['Japan']);
  });

  it('stops notifying after a subscriber unsubscribes', (): void => {
    const service: ReturnType<typeof createHistoryService> =
      createHistoryService(createMemoryStorage());
    const onHistoryChange: ReturnType<typeof vi.fn> = vi.fn();
    const unsubscribe: () => void = service.subscribe(onHistoryChange);

    unsubscribe();
    service.recordQuery('Japan');

    expect(onHistoryChange).not.toHaveBeenCalled();
  });

  it('provides immutable snapshots that do not change after later records', (): void => {
    const service: ReturnType<typeof createHistoryService> =
      createHistoryService(createMemoryStorage());
    let capturedSnapshot: readonly string[] = [];

    service.subscribe((queries: readonly string[]): void => {
      capturedSnapshot = queries;
    });

    service.recordQuery('Japan');

    const firstSnapshot: readonly string[] = capturedSnapshot;

    service.recordQuery('Canada');

    expect(firstSnapshot).toEqual(['Japan']);
    expect(service.getRecentQueries()).toEqual(['Canada', 'Japan']);
  });

  it('does not change state or notify subscribers for an empty query', (): void => {
    const service: ReturnType<typeof createHistoryService> =
      createHistoryService(createMemoryStorage(['Japan']));
    const onHistoryChange: ReturnType<typeof vi.fn> = vi.fn();

    service.subscribe(onHistoryChange);
    service.recordQuery('  ');

    expect(service.getRecentQueries()).toEqual(['Japan']);
    expect(onHistoryChange).not.toHaveBeenCalled();
  });

  it('works with an in-memory storage without browser APIs', (): void => {
    const service: ReturnType<typeof createHistoryService> =
      createHistoryService(createMemoryStorage());

    service.recordQuery('Japan');

    expect(service.getRecentQueries()).toEqual(['Japan']);
  });
});
