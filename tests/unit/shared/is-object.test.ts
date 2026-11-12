import { describe, expect, it } from 'vitest';

import { isObject } from '@/shared/utils/is-object';

describe('isObject', (): void => {
  it('accepts non-null objects, including arrays', (): void => {
    expect(isObject({})).toBe(true);
    expect(isObject([])).toBe(true);
    expect(isObject(new Date())).toBe(true);
  });

  it('rejects null and primitive values', (): void => {
    [null, undefined, 'text', 1, true, Symbol('example')].forEach(
      (value: unknown): void => {
        expect(isObject(value)).toBe(false);
      },
    );
  });
});
