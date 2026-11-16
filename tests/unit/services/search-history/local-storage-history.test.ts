import { describe, expect, it, vi } from 'vitest';

import { createLocalStorageHistoryAdapter } from '@/services/search-history/infrastructure/local-storage-history.adapter';
import type { KeyValueStorage } from '@/shared/application/storage/key-value-storage.port';

import { createMemoryStorage } from '../../../support/storage';

const STORAGE_KEY: string = 'country-search.history.v1';

describe('history storage serialization', (): void => {
  it('loads query strings from the versioned DTO', (): void => {
    const storage: KeyValueStorage = createMemoryStorage();

    storage.setItem(STORAGE_KEY, '{"version":1,"queries":["Japan","Canada"]}');

    expect(createLocalStorageHistoryAdapter(storage).load()).toEqual([
      'Japan',
      'Canada',
    ]);
  });

  it('saves the versioned DTO under the history key', (): void => {
    const storage: KeyValueStorage = createMemoryStorage();

    createLocalStorageHistoryAdapter(storage).save(['Japan']);

    expect(JSON.parse(storage.getItem(STORAGE_KEY) ?? 'null')).toEqual({
      version: 1,
      queries: ['Japan'],
    });
  });

  it('restores saved queries in a new adapter instance', (): void => {
    const storage: KeyValueStorage = createMemoryStorage();

    createLocalStorageHistoryAdapter(storage).save(['Japan', 'Canada']);

    expect(createLocalStorageHistoryAdapter(storage).load()).toEqual([
      'Japan',
      'Canada',
    ]);
  });

  it('filters DTO entries that are not strings', (): void => {
    const storage: KeyValueStorage = createMemoryStorage();

    storage.setItem(
      STORAGE_KEY,
      '{"version":1,"queries":["Japan",42,null,"Canada"]}',
    );

    expect(createLocalStorageHistoryAdapter(storage).load()).toEqual([
      'Japan',
      'Canada',
    ]);
  });

  it.each([
    null,
    '{',
    'null',
    '[]',
    '{"version":2,"queries":["Japan"]}',
    '{"version":1,"queries":"Japan"}',
  ])(
    'returns empty history for missing or invalid DTO %j',
    (serialized: string | null): void => {
      const storage: KeyValueStorage = createMemoryStorage();

      if (serialized !== null) {
        storage.setItem(STORAGE_KEY, serialized);
      }

      expect(createLocalStorageHistoryAdapter(storage).load()).toEqual([]);
    },
  );

  it('returns empty history if initial reading is denied', (): void => {
    const storage: KeyValueStorage = createMemoryStorage();

    vi.spyOn(storage, 'getItem').mockImplementation((): never => {
      throw new Error('Storage denied');
    });

    expect(createLocalStorageHistoryAdapter(storage).load()).toEqual([]);
  });

  it('retains saved queries in memory when storage reports a denied write', (): void => {
    const storage: KeyValueStorage = createMemoryStorage();

    vi.spyOn(storage, 'setItem').mockReturnValue(false);
    const adapter: ReturnType<typeof createLocalStorageHistoryAdapter> =
      createLocalStorageHistoryAdapter(storage);

    adapter.save(['Japan']);

    expect(adapter.load()).toEqual(['Japan']);
    expect(storage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('retains the latest loaded snapshot if a later read fails', (): void => {
    const storage: KeyValueStorage = createMemoryStorage();

    storage.setItem(STORAGE_KEY, '{"version":1,"queries":["Japan"]}');
    const adapter: ReturnType<typeof createLocalStorageHistoryAdapter> =
      createLocalStorageHistoryAdapter(storage);

    expect(adapter.load()).toEqual(['Japan']);
    vi.spyOn(storage, 'getItem').mockImplementation((): never => {
      throw new Error('Storage denied');
    });

    expect(adapter.load()).toEqual(['Japan']);
  });
});
