const HISTORY_LIMIT: number = 10;

export function getNormalizedHistory(
  queries: readonly string[],
): readonly string[] {
  const trimmedQueries: string[] = queries
    .map((query: string): string => query.trim())
    .filter((query: string): boolean => query.length > 0);
  const uniqueQueries: Set<string> = new Set(trimmedQueries);

  return [...uniqueQueries].slice(0, HISTORY_LIMIT);
}

export function addHistoryQuery(
  history: readonly string[],
  query: string,
): readonly string[] {
  const normalizedQuery: string = query.trim();

  if (normalizedQuery.length === 0) {
    return history;
  }

  return getNormalizedHistory([normalizedQuery, ...history]);
}
