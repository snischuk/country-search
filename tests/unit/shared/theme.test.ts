import { describe, expect, it, vi } from 'vitest';

import type { KeyValueStorage } from '@/shared/application/storage/key-value-storage.port';
import {
  getIsDarkThemePreferred,
  saveThemePreference,
} from '@/shared/infrastructure/theme/theme.adapter';

import { createMemoryStorage } from '../../support/storage';

describe('theme preference', (): void => {
  it.each([true, false])(
    'uses system preference %s when no theme is saved',
    (isDarkSystem: boolean): void => {
      const storage: KeyValueStorage = createMemoryStorage();

      vi.stubGlobal('matchMedia', (query: string): { matches: boolean } => ({
        matches: query === '(prefers-color-scheme: dark)' && isDarkSystem,
      }));

      expect(getIsDarkThemePreferred(storage)).toBe(isDarkSystem);
    },
  );

  it.each([
    { theme: 'light', isDark: false },
    { theme: 'dark', isDark: true },
  ])(
    'prioritizes saved $theme over the opposite system preference',
    ({ theme, isDark }: { theme: string; isDark: boolean }): void => {
      const storage: KeyValueStorage = createMemoryStorage();

      storage.setItem('country-search.theme', theme);
      vi.stubGlobal('matchMedia', (): { matches: boolean } => ({
        matches: !isDark,
      }));

      expect(getIsDarkThemePreferred(storage)).toBe(isDark);
    },
  );

  it('falls back to the system preference for an unrecognized saved theme', (): void => {
    const storage: KeyValueStorage = createMemoryStorage();

    storage.setItem('country-search.theme', 'unknown');
    vi.stubGlobal('matchMedia', (): { matches: boolean } => ({
      matches: true,
    }));

    expect(getIsDarkThemePreferred(storage)).toBe(true);
  });

  it.each([
    { isDark: true, theme: 'dark' },
    { isDark: false, theme: 'light' },
  ])(
    'saves the selected $theme theme',
    ({ isDark, theme }: { isDark: boolean; theme: string }): void => {
      const storage: KeyValueStorage = createMemoryStorage();

      saveThemePreference(isDark, storage);

      expect(storage.getItem('country-search.theme')).toBe(theme);
    },
  );

  it('uses the system theme when default localStorage access is denied', (): void => {
    vi.stubGlobal('localStorage', {
      getItem(): never {
        throw new Error('Storage denied');
      },
    });

    vi.stubGlobal('matchMedia', (): { matches: boolean } => ({
      matches: false,
    }));

    expect(getIsDarkThemePreferred()).toBe(false);
  });

  it('allows theme selection when default localStorage writes are denied', (): void => {
    vi.stubGlobal('localStorage', {
      setItem(): never {
        throw new Error('Storage denied');
      },
    });

    expect((): void => saveThemePreference(false)).not.toThrow();
  });
});
