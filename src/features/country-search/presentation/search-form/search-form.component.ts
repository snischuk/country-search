import { createButton, createInput } from '@/shared/presentation/ui-kit';

import './search-form.component.css';

const SEARCH_INPUT_ID: string = 'country-search-input';
const SEARCH_HINT_ID: string = 'country-search-hint';

export interface SearchForm {
  readonly element: HTMLDivElement;
  readonly field: HTMLInputElement;
}

export function createSearchForm(
  onQueryChange: (query: string) => void,
  onSubmit: () => void,
): SearchForm {
  const container: HTMLDivElement = document.createElement('div');
  const form: HTMLFormElement = document.createElement('form');
  const label: HTMLLabelElement = document.createElement('label');
  const field: HTMLInputElement = createInput();
  const submit: HTMLButtonElement = createButton({
    label: 'Search now',
    type: 'submit',
    variant: 'primary',
  });
  const hint: HTMLParagraphElement = document.createElement('p');

  container.className = 'country-search__controls';
  form.className = 'country-search__form';
  label.className = 'country-search__label';
  label.htmlFor = SEARCH_INPUT_ID;
  label.textContent = 'Country name';
  field.id = SEARCH_INPUT_ID;
  field.classList.add('country-search__input');
  field.type = 'search';
  field.name = 'country';
  field.autocomplete = 'off';
  field.placeholder = 'Try Japan or New Zealand';
  field.setAttribute('aria-describedby', SEARCH_HINT_ID);
  submit.classList.add('country-search__submit');
  hint.id = SEARCH_HINT_ID;
  hint.className = 'country-search__hint';
  hint.textContent = 'Results update as you type.';
  form.append(label, field, submit);
  container.append(form, hint);
  field.addEventListener('input', (): void => {
    onQueryChange(field.value);
  });

  form.addEventListener('submit', (event: SubmitEvent): void => {
    event.preventDefault();
    onSubmit();
  });

  return { element: container, field };
}
