import { describe, expect, it } from 'vitest';

import {
  addHistoryQuery,
  getNormalizedHistory,
} from '@/services/search-history/domain/history';

const TEN_RECENT_QUERIES: readonly string[] = [
  'Japan',
  'Canada',
  'Italy',
  'France',
  'Spain',
  'Chile',
  'Peru',
  'Brazil',
  'China',
  'India',
];

describe('history normalization', (): void => {
  it.each([
    { queries: [], expected: [] },
    {
      queries: [' Japan ', '', ' ', '\t\n', ' Canada '],
      expected: ['Japan', 'Canada'],
    },
    {
      queries: ['Canada', ' Japan ', ' Canada ', 'Iceland', 'Japan'],
      expected: ['Canada', 'Japan', 'Iceland'],
    },
    {
      queries: ['Japan', 'japan', 'New Zealand', 'New  Zealand', 'Japan'],
      expected: ['Japan', 'japan', 'New Zealand', 'New  Zealand'],
    },
  ])(
    'trims and deduplicates $queries in newest-first order',
    ({
      queries,
      expected,
    }: {
      queries: readonly string[];
      expected: readonly string[];
    }): void => {
      expect(getNormalizedHistory(queries)).toEqual(expected);
    },
  );

  it('keeps the ten newest distinct entries after skipping invalid and duplicate queries', (): void => {
    const queries: readonly string[] = [
      '',
      ...TEN_RECENT_QUERIES.flatMap((query: string): string[] => [
        query,
        ` ${query} `,
      ]),
      'Norway',
      'Iceland',
    ];

    expect(getNormalizedHistory(queries)).toEqual(TEN_RECENT_QUERIES);
  });

  it('does not mutate loaded history', (): void => {
    const queries: readonly string[] = Object.freeze([
      ' Japan ',
      'Canada',
      'Japan',
    ]);

    expect(getNormalizedHistory(queries)).toEqual(['Japan', 'Canada']);
    expect(queries).toEqual([' Japan ', 'Canada', 'Japan']);
  });

  it('leaves an already normalized snapshot unchanged', (): void => {
    expect(getNormalizedHistory(['Japan', 'Canada'])).toEqual([
      'Japan',
      'Canada',
    ]);
  });
});

describe('recording a history query', (): void => {
  it.each([
    {
      previous: ['Japan', 'Canada'],
      query: ' Iceland ',
      expected: ['Iceland', 'Japan', 'Canada'],
    },
    {
      previous: ['Japan', 'Canada', 'Iceland'],
      query: ' Canada ',
      expected: ['Canada', 'Japan', 'Iceland'],
    },
    {
      previous: ['Japan', 'New Zealand'],
      query: 'japan',
      expected: ['japan', 'Japan', 'New Zealand'],
    },
    {
      previous: ['New Zealand'],
      query: 'New  Zealand',
      expected: ['New  Zealand', 'New Zealand'],
    },
    {
      previous: [' Canada ', '', 'Japan', 'Canada'],
      query: ' Japan ',
      expected: ['Japan', 'Canada'],
    },
  ])(
    'puts $query first without losing distinct queries',
    ({
      previous,
      query,
      expected,
    }: {
      previous: readonly string[];
      query: string;
      expected: readonly string[];
    }): void => {
      expect(addHistoryQuery(previous, query)).toEqual(expected);
    },
  );

  it.each(['', ' ', '\t\n'])(
    'ignores blank input %j',
    (query: string): void => {
      expect(addHistoryQuery(['Japan', 'Canada'], query)).toEqual([
        'Japan',
        'Canada',
      ]);
    },
  );

  it('drops only the oldest query when recording an eleventh distinct query', (): void => {
    expect(addHistoryQuery(TEN_RECENT_QUERIES, 'Norway')).toEqual([
      'Norway',
      'Japan',
      'Canada',
      'Italy',
      'France',
      'Spain',
      'Chile',
      'Peru',
      'Brazil',
      'China',
    ]);
  });

  it('does not evict any query when moving an existing entry in a full history', (): void => {
    expect(addHistoryQuery(TEN_RECENT_QUERIES, 'India')).toEqual([
      'India',
      'Japan',
      'Canada',
      'Italy',
      'France',
      'Spain',
      'Chile',
      'Peru',
      'Brazil',
      'China',
    ]);
  });

  it('returns a new snapshot without changing previous history', (): void => {
    const previous: readonly string[] = Object.freeze(['Japan', 'Canada']);
    const updated: readonly string[] = addHistoryQuery(previous, 'Iceland');

    expect(updated).toEqual(['Iceland', 'Japan', 'Canada']);
    expect(updated).not.toBe(previous);
    expect(previous).toEqual(['Japan', 'Canada']);
  });

  it('keeps a single entry after recording the same normalized query repeatedly', (): void => {
    const first: readonly string[] = addHistoryQuery([], 'Japan');
    const repeated: readonly string[] = addHistoryQuery(first, ' Japan ');

    expect(addHistoryQuery(repeated, 'Japan')).toEqual(['Japan']);
  });
});
