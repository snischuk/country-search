import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createLocalStorageHistoryAdapter } from '@/services/search-history/infrastructure/local-storage-history.adapter';

const STORAGE_KEY: string = 'country-search.history.v1';

function createBrowserStorage(): Storage {
  const entries: Map<string, string> = new Map();

  return {
    length: 0,
    clear: (): void => entries.clear(),
    getItem: (key: string): string | null => entries.get(key) ?? null,
    key: (index: number): string | null => [...entries.keys()][index] ?? null,
    removeItem: (key: string): void => {
      entries.delete(key);
    },
    setItem: (key: string, value: string): void => {
      entries.set(key, value);
    },
  };
}

describe('createLocalStorageHistoryAdapter', (): void => {
  let browserStorage: Storage;

  beforeEach((): void => {
    browserStorage = createBrowserStorage();
    vi.stubGlobal('localStorage', browserStorage);
  });

  it('loads query strings from the versioned DTO', (): void => {
    browserStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ version: 1, queries: ['Japan', 'Canada'] }),
    );

    expect(createLocalStorageHistoryAdapter().load()).toEqual([
      'Japan',
      'Canada',
    ]);
  });

  it('saves the versioned DTO under the history storage key', (): void => {
    createLocalStorageHistoryAdapter().save(['Japan']);

    expect(browserStorage.getItem(STORAGE_KEY)).toBe(
      JSON.stringify({ version: 1, queries: ['Japan'] }),
    );
  });

  it('filters entries that are not strings from the DTO', (): void => {
    browserStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ version: 1, queries: ['Japan', 42, null, 'Canada'] }),
    );

    expect(createLocalStorageHistoryAdapter().load()).toEqual([
      'Japan',
      'Canada',
    ]);
  });

  it.each([
    ['malformed JSON', '{'],
    [
      'an unsupported version',
      JSON.stringify({ version: 2, queries: ['Japan'] }),
    ],
    ['a malformed DTO', JSON.stringify({ version: 1, queries: 'Japan' })],
  ])(
    'returns empty history for %s',
    (_scenario: string, serialized: string): void => {
      browserStorage.setItem(STORAGE_KEY, serialized);

      expect(createLocalStorageHistoryAdapter().load()).toEqual([]);
    },
  );

  it('returns empty history when browser storage denies reads', (): void => {
    vi.stubGlobal('localStorage', {
      ...browserStorage,
      getItem: (): never => {
        throw new Error('Storage access denied');
      },
    });

    expect(createLocalStorageHistoryAdapter().load()).toEqual([]);
  });

  it('does not throw when browser storage denies writes', (): void => {
    vi.stubGlobal('localStorage', {
      ...browserStorage,
      setItem: (): never => {
        throw new Error('Storage access denied');
      },
    });

    const saveHistory: () => void = (): void => {
      createLocalStorageHistoryAdapter().save(['Japan']);
    };

    expect(saveHistory).not.toThrow();
  });
});
