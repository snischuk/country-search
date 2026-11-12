const maximumHistoryLength: number = 5;

// TODO: Keep history limits and duplicate handling here, independently of storage.
export function recordSearchQuery(
  history: readonly string[],
  query: string,
): string[] {
  const normalizedQuery: string = query.trim();

  if (normalizedQuery.length === 0) {
    return [...history];
  }

  return [
    normalizedQuery,
    ...history.filter(
      (recentQuery: string): boolean =>
        recentQuery.toLowerCase() !== normalizedQuery.toLowerCase(),
    ),
  ].slice(0, maximumHistoryLength);
}

export function normalizeSearchHistory(queries: readonly string[]): string[] {
  return queries.reduceRight(
    (history: string[], query: string): string[] =>
      recordSearchQuery(history, query),
    [],
  );
}
