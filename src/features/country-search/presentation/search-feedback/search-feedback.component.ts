import { SEARCH_STATUS } from '@/features/country-search/domain/search-state.type';
import type { SearchState } from '@/features/country-search/domain/search-state.type';
import {
  getCountryResultLabel,
  getStatusMessage,
} from '@/features/country-search/presentation/country-search.utility';
import { createButton } from '@/shared/presentation/ui-kit';

import './search-feedback.component.css';

const SEARCH_ERROR_ID: string = 'country-search-error';

export interface SearchFeedback {
  readonly element: HTMLDivElement;
  render(state: SearchState): void;
}

export function createSearchFeedback(
  onRetry: () => void,
  getReturnFocus: () => HTMLElement,
): SearchFeedback {
  const container: HTMLDivElement = document.createElement('div');
  const status: HTMLParagraphElement = document.createElement('p');
  const errorMessage: HTMLParagraphElement = document.createElement('p');
  const retryButton: HTMLButtonElement = createButton({
    label: 'Try again',
    variant: 'primary',
  });

  status.className = 'country-search__status';
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  status.setAttribute('aria-atomic', 'true');
  errorMessage.id = SEARCH_ERROR_ID;
  errorMessage.className = 'country-search__error';
  errorMessage.setAttribute('role', 'alert');
  errorMessage.setAttribute('aria-atomic', 'true');
  retryButton.classList.add('country-search__retry');
  retryButton.setAttribute('aria-describedby', SEARCH_ERROR_ID);
  retryButton.hidden = true;
  retryButton.addEventListener('click', (): void => {
    onRetry();
  });

  container.append(status, errorMessage, retryButton);

  return {
    element: container,
    render(state: SearchState): void {
      const shouldRestoreFocus: boolean =
        state.status !== SEARCH_STATUS.error &&
        document.activeElement === retryButton;

      const statusMessage: string = getStatusMessage(state);

      if (status.textContent !== statusMessage) {
        status.textContent = statusMessage;

        if (state.status === SEARCH_STATUS.results) {
          const query: HTMLElement = document.createElement('strong');

          query.textContent = state.query;
          status.replaceChildren(
            `${getCountryResultLabel(state.countries.length)} found for `,
            query,
            '.',
          );
        }
      }

      status.dataset['state'] = state.status;
      const errorText: string =
        state.status === SEARCH_STATUS.error ? state.message : '';

      if (errorMessage.textContent !== errorText) {
        errorMessage.textContent = errorText;
      }

      retryButton.hidden = state.status !== SEARCH_STATUS.error;
      if (shouldRestoreFocus) {
        getReturnFocus().focus();
      }
    },
  };
}
