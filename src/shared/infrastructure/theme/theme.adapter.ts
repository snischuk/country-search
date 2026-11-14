import type { KeyValueStorage } from '@/shared/application/storage/key-value-storage.port';
import { localStorageService } from '@/shared/infrastructure/storage/local-storage.adapter';

const THEME_STORAGE_KEY: string = 'country-search.theme';
const DARK_THEME: string = 'dark';
const LIGHT_THEME: string = 'light';
const DARK_THEME_QUERY: string = '(prefers-color-scheme: dark)';

export function getIsDarkThemePreferred(
  storage: KeyValueStorage = localStorageService,
): boolean {
  const storedTheme: string | null = storage.getItem(THEME_STORAGE_KEY);

  if (storedTheme === DARK_THEME || storedTheme === LIGHT_THEME) {
    return storedTheme === DARK_THEME;
  }

  return matchMedia(DARK_THEME_QUERY).matches;
}

export function saveThemePreference(
  isDarkTheme: boolean,
  storage: KeyValueStorage = localStorageService,
): void {
  storage.setItem(THEME_STORAGE_KEY, isDarkTheme ? DARK_THEME : LIGHT_THEME);
}
