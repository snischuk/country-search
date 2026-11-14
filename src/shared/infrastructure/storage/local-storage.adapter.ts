import type { KeyValueStorage } from '../../application/storage/key-value-storage.port';

export const localStorageService: KeyValueStorage = {
  getItem(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  setItem(key: string, text: string): boolean {
    try {
      localStorage.setItem(key, text);

      return true;
    } catch {
      return false;
    }
  },
  removeItem(key: string): boolean {
    try {
      localStorage.removeItem(key);

      return true;
    } catch {
      return false;
    }
  },
};
