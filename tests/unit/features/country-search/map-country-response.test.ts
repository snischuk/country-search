import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { ValidationError } from '@/features/country-search/application/search-errors';
import type { Country } from '@/features/country-search/domain/country.type';
import { mapCountryResponse } from '@/features/country-search/infrastructure/http/map-country-response';

const fullResponse: unknown = JSON.parse(
  readFileSync(
    new URL('../../../fixtures/countries/full.json', import.meta.url),
    'utf8',
  ),
);
const partialResponse: unknown = JSON.parse(
  readFileSync(
    new URL('../../../fixtures/countries/partial.json', import.meta.url),
    'utf8',
  ),
);

describe('mapCountryResponse', (): void => {
  it('maps documented fields into the complete country model', (): void => {
    expect(mapCountryResponse(fullResponse)).toEqual({
      id: 'ISR',
      name: 'Israel',
      capital: 'Jerusalem',
      region: 'Asia',
      population: 9216900,
      area: 20770,
      languages: ['Hebrew'],
      borders: ['EGY', 'JOR', 'LBN', 'SYR'],
      currencies: [{ code: 'ILS', name: 'Israeli new shekel', symbol: '₪' }],
      flagUrl: 'https://example.com/flag.svg',
      flagEmoji: '🇮🇱',
      description: 'Israel is in Asia. Capital: Jerusalem.',
    });
  });

  it('represents missing optional fields explicitly', (): void => {
    expect(mapCountryResponse(partialResponse)).toEqual({
      id: 'Example Island',
      name: 'Example Island',
      capital: null,
      region: null,
      population: null,
      area: null,
      flagUrl: null,
      flagEmoji: '🏳️',
      languages: [],
      currencies: [],
      borders: [],
      description: 'Example Island.',
    });
  });

  it.each(
    [null, [], undefined, 1, {}, { name: '' }, { name: ' ' }, { name: 42 }].map(
      (payload: unknown): { payload: unknown } => ({ payload }),
    ),
  )(
    'rejects an invalid required name or payload: $payload',
    ({ payload }: { payload: unknown }): void => {
      expect((): Country => mapCountryResponse(payload)).toThrow(
        ValidationError,
      );
    },
  );

  it.each([
    { population: 0, area: 0, expectedPopulation: 0, expectedArea: 0 },
    {
      population: -1,
      area: Number.NaN,
      expectedPopulation: null,
      expectedArea: null,
    },
    {
      population: Infinity,
      area: '100',
      expectedPopulation: null,
      expectedArea: null,
    },
  ])(
    'normalizes numeric fields: $population / $area',
    ({
      population,
      area,
      expectedPopulation,
      expectedArea,
    }: {
      population: unknown;
      area: unknown;
      expectedPopulation: number | null;
      expectedArea: number | null;
    }): void => {
      expect(
        mapCountryResponse({ name: 'Example', population, area }),
      ).toMatchObject({ population: expectedPopulation, area: expectedArea });
    },
  );

  it.each([
    {
      payload: {
        name: 'Example',
        flags: {
          svg: 'javascript:alert(1)',
          png: 'https://example.com/flag.png',
        },
      },
      flagUrl: 'https://example.com/flag.png',
      flagEmoji: null,
    },
    {
      payload: { name: 'Example', flag: 'https://example.com/flag.svg' },
      flagUrl: 'https://example.com/flag.svg',
      flagEmoji: null,
    },
    { payload: { name: 'Japan', flag: '🇯🇵' }, flagUrl: null, flagEmoji: '🇯🇵' },
    {
      payload: {
        name: 'Example',
        flag: 'javascript:alert(1)',
        flags: { svg: 'data:text/html,unsafe' },
      },
      flagUrl: null,
      flagEmoji: null,
    },
  ])(
    'normalizes a flag safely: $payload',
    ({
      payload,
      flagUrl,
      flagEmoji,
    }: {
      payload: unknown;
      flagUrl: string | null;
      flagEmoji: string | null;
    }): void => {
      expect(mapCountryResponse(payload)).toMatchObject({ flagUrl, flagEmoji });
    },
  );

  it('trims text and filters malformed optional collection entries', (): void => {
    expect(
      mapCountryResponse({
        name: ' Example ',
        languages: [null, { name: ' English ' }, { name: '' }],
        currencies: [{ name: ' Dollar ', code: ' USD ' }, null],
        borders: [' AAA ', 42, ''],
      }),
    ).toMatchObject({
      name: 'Example',
      languages: ['English'],
      currencies: [{ name: 'Dollar', code: 'USD', symbol: null }],
      borders: ['AAA'],
    });
  });

  it('returns normalized collections without mutating or sharing the input arrays', (): void => {
    const payload: { name: string; borders: string[] } = {
      name: 'Example',
      borders: [' AAA '],
    };
    const mapped: Country = mapCountryResponse(payload);

    expect(mapped.borders).toEqual(['AAA']);
    expect(payload.borders).toEqual([' AAA ']);
    payload.borders.push('BBB');
    expect(mapped.borders).toEqual(['AAA']);
  });
});
