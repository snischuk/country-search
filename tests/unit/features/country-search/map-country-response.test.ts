import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { ValidationError } from '@/features/country-search/application/search-errors';
import type { Country } from '@/features/country-search/domain/country.type';
import { mapCountryResponse } from '@/features/country-search/infrastructure/http/map-country-response';

const fullCountryResponse: unknown = JSON.parse(
  readFileSync(
    new URL('../../../fixtures/countries/full.json', import.meta.url),
    'utf8',
  ),
);
const partialCountryResponse: unknown = JSON.parse(
  readFileSync(
    new URL('../../../fixtures/countries/partial.json', import.meta.url),
    'utf8',
  ),
);

describe('mapCountryResponse', (): void => {
  it('maps the documented country fields', (): void => {
    const mappedCountry: Country = mapCountryResponse(fullCountryResponse);

    expect(mappedCountry).toMatchObject({
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
    });

    expect(mappedCountry.description).toContain('Israel');
    expect(mappedCountry.description).toContain('Asia');
  });

  it('preserves unavailable optional values rather than inventing data', (): void => {
    const mappedCountry: Country = mapCountryResponse(partialCountryResponse);

    expect(mappedCountry).toMatchObject({
      id: 'Example Island',
      name: 'Example Island',
      capital: null,
      region: null,
      population: null,
      area: null,
      flagUrl: null,
      languages: [],
      currencies: [],
      borders: [],
    });
  });

  it('rejects invalid required names and non-record payloads', (): void => {
    [null, [], 1, {}, { name: '' }, { name: '   ' }, { name: 42 }].forEach(
      (invalidCountryResponse: unknown): void => {
        expect((): Country =>
          mapCountryResponse(invalidCountryResponse),
        ).toThrow(ValidationError);
      },
    );
  });

  it('accepts finite zero and rejects invalid numeric fields as unavailable', (): void => {
    expect(
      mapCountryResponse({ name: 'Example', population: 0, area: 0 }),
    ).toMatchObject({ population: 0, area: 0 });

    expect(
      mapCountryResponse({ name: 'Example', population: -1, area: Number.NaN }),
    ).toMatchObject({ population: null, area: null });

    expect(
      mapCountryResponse({
        name: 'Example',
        population: Infinity,
        area: '100',
      }),
    ).toMatchObject({ population: null, area: null });
  });

  it('validates flag protocols and supports png, URL and emoji variants', (): void => {
    expect(
      mapCountryResponse({
        name: 'Example',
        flags: {
          svg: 'javascript:alert(1)',
          png: 'https://example.com/flag.png',
        },
      }).flagUrl,
    ).toBe('https://example.com/flag.png');

    expect(
      mapCountryResponse({
        name: 'Example',
        flag: 'https://example.com/flag.svg',
      }).flagUrl,
    ).toBe('https://example.com/flag.svg');

    expect(mapCountryResponse({ name: 'Japan', flag: '🇯🇵' })).toMatchObject({
      flagEmoji: '🇯🇵',
      flagUrl: null,
    });

    expect(
      mapCountryResponse({
        name: 'Example',
        flag: 'javascript:alert(1)',
        flags: { svg: 'data:text/html,unsafe' },
      }),
    ).toMatchObject({ flagUrl: null, flagEmoji: null });
  });

  it('filters malformed optional collection entries and normalizes text', (): void => {
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

  it('does not mutate input collections', (): void => {
    const rawCountry: { name: string; borders: string[] } = {
      name: 'Example',
      borders: [' AAA '],
    };
    const mappedCountry: Country = mapCountryResponse(rawCountry);

    expect(rawCountry.borders).toEqual([' AAA ']);
    expect(mappedCountry.borders).toEqual(['AAA']);
  });
});
