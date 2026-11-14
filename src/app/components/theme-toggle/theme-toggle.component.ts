import { createButton } from '@/shared/presentation/ui-kit';

import './theme-toggle.component.css';

export function createThemeToggle(
  isDarkThemeInitially: boolean,
  onThemeChange: (isDarkTheme: boolean) => void,
): HTMLButtonElement {
  const button: HTMLButtonElement = createButton();
  const sun: HTMLSpanElement = document.createElement('span');
  const moon: HTMLSpanElement = document.createElement('span');
  let isDarkTheme: boolean = isDarkThemeInitially;

  button.classList.add('theme-toggle');
  button.setAttribute('aria-label', 'Dark theme');
  sun.className = 'theme-toggle__icon theme-toggle__icon--sun';
  moon.className = 'theme-toggle__icon theme-toggle__icon--moon';
  sun.setAttribute('aria-hidden', 'true');
  moon.setAttribute('aria-hidden', 'true');
  button.append(sun, moon);
  button.title = isDarkTheme ? 'Switch to light theme' : 'Switch to dark theme';
  button.setAttribute('aria-pressed', String(isDarkTheme));
  button.addEventListener('click', (): void => {
    isDarkTheme = !isDarkTheme;
    button.setAttribute('aria-pressed', String(isDarkTheme));
    button.title = isDarkTheme
      ? 'Switch to light theme'
      : 'Switch to dark theme';

    onThemeChange(isDarkTheme);
  });

  return button;
}
