import { describe, expect, it } from 'vitest';

import { SEARCH_STATUS } from '@/features/country-search/domain/search-state.type';
import type { SearchState } from '@/features/country-search/domain/search-state.type';
import {
  getBorderCountryName,
  getCountryResultLabel,
  getStatusMessage,
} from '@/features/country-search/presentation/country-search.utility';

describe('country search feedback', (): void => {
  it.each([
    { countryCount: 0, label: '0 countries' },
    { countryCount: 1, label: '1 country' },
    { countryCount: 3, label: '3 countries' },
  ])(
    'formats $countryCount matches as $label',
    ({
      countryCount,
      label,
    }: {
      countryCount: number;
      label: string;
    }): void => {
      expect(getCountryResultLabel(countryCount)).toBe(label);
    },
  );

  it('offers a next step when no countries match', (): void => {
    const state: SearchState = { status: SEARCH_STATUS.empty, query: 'qwerty' };

    expect(getStatusMessage(state)).toContain(
      'Check the spelling or try a shorter name.',
    );
  });
});

describe('border country names', (): void => {
  it.each([
    { code: 'DEU', name: 'Germany' },
    { code: 'NAM', name: 'Namibia' },
    { code: 'ZMB', name: 'Zambia' },
    { code: 'JP', name: 'Japan' },
    { code: 'fra', name: 'France' },
  ])(
    'displays $code as $name',
    ({ code, name }: { code: string; name: string }): void => {
      expect(getBorderCountryName(code)).toBe(name);
    },
  );

  it.each(['XYZ', 'Not a code', '', '<script>', '__proto__'])(
    'preserves an unknown code safely: %j',
    (code: string): void => {
      expect(getBorderCountryName(code)).toBe(code);
    },
  );
});
