import type {
  ListRecentSearchesUseCase,
  SearchHistoryReader,
} from '../application/list-recent-searches.use-case';

export function renderRecentSearches(
  root: HTMLElement,
  historyReader: SearchHistoryReader,
  listRecentSearches: ListRecentSearchesUseCase,
): void {
  const section: HTMLElement = document.createElement('section');

  section.className = 'recent-searches';

  const heading: HTMLHeadingElement = document.createElement('h2');

  heading.textContent = 'Recent searches';

  const list: HTMLUListElement = document.createElement('ul');

  const renderItems: () => void = (): void => {
    const queries: string[] = listRecentSearches();

    list.replaceChildren();

    if (queries.length === 0) {
      const item: HTMLLIElement = document.createElement('li');

      item.textContent = 'Your searches will appear here.';
      list.append(item);

      return;
    }

    queries.forEach((query: string): void => {
      const item: HTMLLIElement = document.createElement('li');

      item.textContent = query;
      list.append(item);
    });
  };

  // TODO: Add controls to repeat or clear searches if the product needs them.
  renderItems();
  historyReader.subscribe(renderItems);
  section.append(heading, list);
  root.append(section);
}
