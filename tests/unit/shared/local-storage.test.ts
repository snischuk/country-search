import { describe, expect, it, vi } from 'vitest';
import type { Mock } from 'vitest';

import { localStorageService } from '@/shared/infrastructure/storage/local-storage.adapter';

describe('localStorageService', (): void => {
  it.each(['saved text', null])(
    'returns stored text or a missing value: %j',
    (text: string | null): void => {
      const getItem: Mock<(key: string) => string | null> = vi
        .fn()
        .mockReturnValue(text);

      vi.stubGlobal('localStorage', { getItem });

      expect(localStorageService.getItem('example')).toBe(text);
      expect(getItem).toHaveBeenCalledExactlyOnceWith('example');
    },
  );

  it('passes a key and plain text to browser storage', (): void => {
    const setItem: Mock<(key: string, text: string) => void> = vi.fn();

    vi.stubGlobal('localStorage', { setItem });

    expect(localStorageService.setItem('example', 'plain text')).toBe(true);
    expect(setItem).toHaveBeenCalledExactlyOnceWith('example', 'plain text');
  });

  it('removes only the supplied key', (): void => {
    const removeItem: Mock<(key: string) => void> = vi.fn();

    vi.stubGlobal('localStorage', { removeItem });

    expect(localStorageService.removeItem('example')).toBe(true);
    expect(removeItem).toHaveBeenCalledExactlyOnceWith('example');
  });

  it('reports denied browser operations without throwing', (): void => {
    function rejectAccess(): never {
      throw new Error('Storage denied');
    }

    vi.stubGlobal('localStorage', {
      getItem: rejectAccess,
      setItem: rejectAccess,
      removeItem: rejectAccess,
    });

    expect(localStorageService.getItem('example')).toBeNull();
    expect(localStorageService.setItem('example', 'text')).toBe(false);
    expect(localStorageService.removeItem('example')).toBe(false);
  });

  it('handles an unavailable localStorage global', (): void => {
    vi.stubGlobal('localStorage', undefined);

    expect(localStorageService.getItem('example')).toBeNull();
    expect(localStorageService.setItem('example', 'text')).toBe(false);
    expect(localStorageService.removeItem('example')).toBe(false);
  });
});
