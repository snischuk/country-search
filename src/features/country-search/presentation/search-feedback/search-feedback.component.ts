import { createButton } from '@/shared/presentation/ui-kit';

import { SEARCH_STATUS } from '../../domain/search-state.type';
import type { SearchState } from '../../domain/search-state.type';
import { getStatusMessage } from '../country-search.utility';

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

      status.textContent = getStatusMessage(state);
      status.dataset['state'] = state.status;
      errorMessage.textContent =
        state.status === SEARCH_STATUS.error ? state.message : '';

      retryButton.hidden = state.status !== SEARCH_STATUS.error;
      if (shouldRestoreFocus) {
        getReturnFocus().focus();
      }
    },
  };
}
