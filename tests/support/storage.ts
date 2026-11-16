import type { KeyValueStorage } from '@/shared/application/storage/key-value-storage.port';

export function createMemoryStorage(): KeyValueStorage {
  const entries: Map<string, string> = new Map();

  return {
    getItem(key: string): string | null {
      return entries.get(key) ?? null;
    },
    setItem(key: string, text: string): boolean {
      entries.set(key, text);

      return true;
    },
    removeItem(key: string): boolean {
      entries.delete(key);

      return true;
    },
  };
}
