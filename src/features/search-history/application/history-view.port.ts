export interface HistoryViewPort {
  getRecentQueries(): readonly string[];
  subscribe(onHistoryChange: (queries: readonly string[]) => void): () => void;
}

export interface HistoryPanelCallbacks {
  onSelect(query: string): void;
}
