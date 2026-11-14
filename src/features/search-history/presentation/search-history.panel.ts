import type {
  HistoryPanelCallbacks,
  HistoryViewPort,
} from '../application/history-view.port';

import './search-history.panel.css';

const SEARCH_HISTORY_HEADING_ID: string = 'search-history-heading';

export interface SearchHistoryPanel {
  readonly element: HTMLElement;
  destroy(): void;
}

export function createSearchHistoryPanel(
  history: HistoryViewPort,
  callbacks: HistoryPanelCallbacks,
): SearchHistoryPanel {
  const section: HTMLElement = document.createElement('section');
  const heading: HTMLHeadingElement = document.createElement('h2');
  const list: HTMLUListElement = document.createElement('ul');
  const noHistoryMessage: HTMLParagraphElement = document.createElement('p');
  let recentQueries: readonly string[] = history.getRecentQueries();

  section.className = 'search-history';
  section.setAttribute('aria-labelledby', SEARCH_HISTORY_HEADING_ID);
  heading.id = SEARCH_HISTORY_HEADING_ID;
  heading.textContent = 'Recent searches';
  list.setAttribute('aria-label', 'Recent searches');
  noHistoryMessage.textContent = 'No recent searches.';
  noHistoryMessage.setAttribute('role', 'status');
  noHistoryMessage.setAttribute('aria-live', 'polite');
  section.append(heading, list, noHistoryMessage);

  function render(): void {
    list.replaceChildren();
    recentQueries.forEach((query: string): void => {
      const listItem: HTMLLIElement = document.createElement('li');
      const queryButton: HTMLButtonElement = document.createElement('button');

      queryButton.type = 'button';
      queryButton.textContent = query;
      queryButton.addEventListener('click', (): void => {
        callbacks.onSelect(query);
      });

      listItem.append(queryButton);
      list.append(listItem);
    });

    noHistoryMessage.hidden = recentQueries.length > 0;
  }

  const unsubscribe: () => void = history.subscribe(
    (queries: readonly string[]): void => {
      recentQueries = queries;
      render();
    },
  );

  render();

  return {
    element: section,
    destroy(): void {
      unsubscribe();
      section.remove();
    },
  };
}
