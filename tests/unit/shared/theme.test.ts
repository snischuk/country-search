import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  getIsDarkThemePreferred,
  saveThemePreference,
} from '@/shared/infrastructure/theme/theme.adapter';

afterEach((): void => {
  vi.unstubAllGlobals();
});

describe('theme preference', (): void => {
  it('uses the system preference when no choice is saved', (): void => {
    vi.stubGlobal('localStorage', { getItem: (): null => null });
    vi.stubGlobal('matchMedia', (): { matches: boolean } => ({
      matches: true,
    }));

    expect(getIsDarkThemePreferred()).toBe(true);
  });

  it('prioritizes a saved light theme over a dark system theme', (): void => {
    vi.stubGlobal('localStorage', { getItem: (): string => 'light' });
    vi.stubGlobal('matchMedia', (): { matches: boolean } => ({
      matches: true,
    }));

    expect(getIsDarkThemePreferred()).toBe(false);
  });

  it('falls back to the system preference if storage is denied', (): void => {
    vi.stubGlobal('localStorage', {
      getItem: (): never => {
        throw new Error('Storage denied');
      },
    });

    vi.stubGlobal('matchMedia', (): { matches: boolean } => ({
      matches: false,
    }));

    expect(getIsDarkThemePreferred()).toBe(false);
  });

  it('saves the selected theme', (): void => {
    const setItem: ReturnType<typeof vi.fn> = vi.fn();

    vi.stubGlobal('localStorage', { setItem });
    saveThemePreference(true);

    expect(setItem).toHaveBeenCalledWith('country-search.theme', 'dark');
  });

  it('allows switching when storage is denied', (): void => {
    vi.stubGlobal('localStorage', {
      setItem: (): never => {
        throw new Error('Storage denied');
      },
    });

    expect((): void => saveThemePreference(false)).not.toThrow();
  });
});
