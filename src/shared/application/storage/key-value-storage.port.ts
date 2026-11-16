export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, text: string): boolean;
  removeItem(key: string): boolean;
}
