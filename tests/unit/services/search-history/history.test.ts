import { describe, expect, it } from 'vitest';

import {
  addHistoryQuery,
  getNormalizedHistory,
} from '@/services/search-history/domain/history';

const EXPECTED_HISTORY_LIMIT: number = 10;
const QUERIES: readonly string[] = [
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
  'Norway',
  'Iceland',
];

describe('getNormalizedHistory', (): void => {
  it('keeps empty history empty', (): void => {
    expect(getNormalizedHistory([])).toEqual([]);
  });

  it('trims entries and removes empty or whitespace-only queries', (): void => {
    expect(
      getNormalizedHistory([' Japan ', '', '  ', '\t\n', ' Canada ']),
    ).toEqual(['Japan', 'Canada']);
  });

  it('retains the first and newest valid occurrence of a duplicate', (): void => {
    expect(
      getNormalizedHistory([
        'Canada',
        ' Japan ',
        ' Canada ',
        'Iceland',
        'Japan',
      ]),
    ).toEqual(['Canada', 'Japan', 'Iceland']);
  });

  it('keeps case variants and internal whitespace distinct', (): void => {
    expect(
      getNormalizedHistory([
        'Japan',
        'japan',
        'New Zealand',
        'New  Zealand',
        'Japan',
      ]),
    ).toEqual(['Japan', 'japan', 'New Zealand', 'New  Zealand']);
  });

  it('retains the ten newest distinct nonempty entries after normalization', (): void => {
    const loadedQueries: readonly string[] = [
      '',
      '  ',
      ...QUERIES.flatMap((query: string): string[] => [query, ` ${query} `]),
    ];

    expect(getNormalizedHistory(loadedQueries)).toEqual(
      QUERIES.slice(0, EXPECTED_HISTORY_LIMIT),
    );

    expect(getNormalizedHistory(loadedQueries)).toHaveLength(
      EXPECTED_HISTORY_LIMIT,
    );
  });

  it('does not mutate the loaded input', (): void => {
    const loadedQueries: readonly string[] = Object.freeze([
      ' Japan ',
      'Canada',
      'Japan',
    ]);

    expect(getNormalizedHistory(loadedQueries)).toEqual(['Japan', 'Canada']);
    expect(loadedQueries).toEqual([' Japan ', 'Canada', 'Japan']);
  });

  it('is stable when normalizing an already normalized snapshot', (): void => {
    const normalized: readonly string[] = getNormalizedHistory([
      ' Japan ',
      'Canada',
      'Japan',
    ]);

    expect(getNormalizedHistory(normalized)).toEqual(normalized);
  });
});

describe('addHistoryQuery', (): void => {
  it('adds a trimmed query at the front', (): void => {
    expect(addHistoryQuery(['Japan', 'Canada'], ' Iceland ')).toEqual([
      'Iceland',
      'Japan',
      'Canada',
    ]);
  });

  it('moves an existing query to the front without duplicating it', (): void => {
    expect(addHistoryQuery(['Japan', 'Canada', 'Iceland'], ' Canada ')).toEqual(
      ['Canada', 'Japan', 'Iceland'],
    );
  });

  it('compares queries with case and internal whitespace preserved', (): void => {
    expect(addHistoryQuery(['Japan', 'New Zealand'], 'japan')).toEqual([
      'japan',
      'Japan',
      'New Zealand',
    ]);

    expect(addHistoryQuery(['New Zealand'], 'New  Zealand')).toEqual([
      'New  Zealand',
      'New Zealand',
    ]);
  });

  it.each(['', '  ', '\t\n'])(
    'ignores empty input %j',
    (query: string): void => {
      const history: readonly string[] = ['Japan', 'Canada'];

      expect(addHistoryQuery(history, query)).toEqual(history);
    },
  );

  it('drops only the oldest entry when adding to a full history', (): void => {
    const fullHistory: readonly string[] = QUERIES.slice(
      0,
      EXPECTED_HISTORY_LIMIT,
    );
    const updated: readonly string[] = addHistoryQuery(fullHistory, 'Norway');

    expect(updated).toEqual(['Norway', ...fullHistory.slice(0, -1)]);
    expect(updated).toHaveLength(EXPECTED_HISTORY_LIMIT);
    expect(updated).not.toContain('India');
  });

  it('keeps every existing entry when repeating a query at the limit', (): void => {
    const fullHistory: readonly string[] = QUERIES.slice(
      0,
      EXPECTED_HISTORY_LIMIT,
    );

    expect(addHistoryQuery(fullHistory, 'India')).toEqual([
      'India',
      ...fullHistory.slice(0, -1),
    ]);
  });

  it('maintains domain invariants when previous entries need normalization', (): void => {
    expect(
      addHistoryQuery([' Canada ', '', 'Japan', 'Canada'], ' Japan '),
    ).toEqual(['Japan', 'Canada']);
  });

  it('returns a new snapshot without changing the old one', (): void => {
    const history: readonly string[] = Object.freeze(['Japan', 'Canada']);
    const updated: readonly string[] = addHistoryQuery(history, 'Iceland');

    expect(updated).toEqual(['Iceland', 'Japan', 'Canada']);
    expect(updated).not.toBe(history);
    expect(history).toEqual(['Japan', 'Canada']);
  });

  it('keeps one entry after repeated recording of the same query', (): void => {
    const first: readonly string[] = addHistoryQuery([], 'Japan');
    const repeated: readonly string[] = addHistoryQuery(first, ' Japan ');

    expect(addHistoryQuery(repeated, 'Japan')).toEqual(['Japan']);
  });
});
