import { describe, expect, it } from 'vitest';

import {
  getBorderCountryName,
  getCountryResultLabel,
  getStatusMessage,
} from '@/features/country-search/presentation/country-search.utility';

describe('country search feedback', (): void => {
  it.each([
    [0, '0 countries'],
    [1, '1 country'],
    [3, '3 countries'],
  ])(
    'formats %i matches as %s',
    (countryCount: number, label: string): void => {
      expect(getCountryResultLabel(countryCount)).toBe(label);
    },
  );

  it('offers a next step when a search has no matches', (): void => {
    expect(getStatusMessage({ status: 'empty', query: 'qwerty' })).toContain(
      'Check the spelling or try a shorter name.',
    );
  });
});

describe('border country names', (): void => {
  it.each([
    ['DEU', 'Germany'],
    ['NAM', 'Namibia'],
    ['ZMB', 'Zambia'],
    ['JP', 'Japan'],
    ['fra', 'France'],
  ])('displays %s as %s', (countryCode: string, countryName: string): void => {
    expect(getBorderCountryName(countryCode)).toBe(countryName);
  });

  it.each(['XYZ', 'Not a code', '', '<script>', '__proto__'])(
    'preserves an unknown code safely: %s',
    (countryCode: string): void => {
      expect(getBorderCountryName(countryCode)).toBe(countryCode);
    },
  );
});
