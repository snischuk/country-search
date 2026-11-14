export function getNormalizedHistory(
  queries: readonly string[],
): readonly string[] {
  throw new Error('Not implemented', { cause: queries });
}

export function addHistoryQuery(
  history: readonly string[],
  query: string,
): readonly string[] {
  throw new Error('Not implemented', { cause: { history, query } });
}
