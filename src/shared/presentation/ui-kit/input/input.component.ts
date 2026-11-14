import './input.component.css';

export function createInput(): HTMLInputElement {
  const input: HTMLInputElement = document.createElement('input');

  input.className = 'ui-input';

  return input;
}
