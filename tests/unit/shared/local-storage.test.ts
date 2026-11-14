import { afterEach, describe, expect, it, vi } from 'vitest';

import { localStorageService } from '@/shared/infrastructure/storage/local-storage.adapter';

afterEach((): void => {
  vi.unstubAllGlobals();
});

describe('localStorageService', (): void => {
  it('reads a string from the supplied key', (): void => {
    const getItem: ReturnType<typeof vi.fn> = vi.fn((): string => 'saved text');

    vi.stubGlobal('localStorage', { getItem });

    expect(localStorageService.getItem('example')).toBe('saved text');
    expect(getItem).toHaveBeenCalledWith('example');
  });

  it('returns null for a missing key', (): void => {
    vi.stubGlobal('localStorage', { getItem: (): null => null });

    expect(localStorageService.getItem('missing')).toBeNull();
  });

  it('writes strings without serializing them', (): void => {
    const setItem: ReturnType<typeof vi.fn> = vi.fn();

    vi.stubGlobal('localStorage', { setItem });

    expect(localStorageService.setItem('example', 'plain text')).toBe(true);
    expect(setItem).toHaveBeenCalledWith('example', 'plain text');
  });

  it('removes only the supplied key', (): void => {
    const removeItem: ReturnType<typeof vi.fn> = vi.fn();

    vi.stubGlobal('localStorage', { removeItem });

    expect(localStorageService.removeItem('example')).toBe(true);
    expect(removeItem).toHaveBeenCalledWith('example');
  });

  it('reports denied reads, writes and removals without throwing', (): void => {
    function rejectStorageAccess(): never {
      throw new Error('Storage denied');
    }

    vi.stubGlobal('localStorage', {
      getItem: rejectStorageAccess,
      setItem: rejectStorageAccess,
      removeItem: rejectStorageAccess,
    });

    expect(localStorageService.getItem('example')).toBeNull();
    expect(localStorageService.setItem('example', 'text')).toBe(false);
    expect(localStorageService.removeItem('example')).toBe(false);
  });
});
