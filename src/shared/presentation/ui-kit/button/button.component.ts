import './button.component.css';

export interface ButtonOptions {
  readonly label?: string;
  readonly type?: 'button' | 'submit';
  readonly variant?: 'plain' | 'primary';
}

export function createButton(options: ButtonOptions = {}): HTMLButtonElement {
  const button: HTMLButtonElement = document.createElement('button');

  button.type = options.type ?? 'button';
  button.textContent = options.label ?? '';
  button.className = 'ui-button';
  if (options.variant === 'primary') {
    button.classList.add('ui-button--primary');
  }

  return button;
}
