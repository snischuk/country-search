import type { Country, Currency } from '../domain/country.type';

const DETAILS_TITLE_ID: string = 'country-details-title';
const DETAILS_DESCRIPTION_ID: string = 'country-details-description';
const UNAVAILABLE_VALUE: string = 'Not available';

export interface CountryDetails {
  readonly element: HTMLDialogElement;
  render(country: Country | null): void;
}

function formatCurrency(currency: Currency): string {
  const currencyParts: string[] = [currency.name];

  if (currency.code !== null) {
    currencyParts.push(currency.code);
  }

  if (currency.symbol !== null) {
    currencyParts.push(currency.symbol);
  }

  return currencyParts.join(' · ');
}

function createDetail(label: string, text: string): HTMLDivElement {
  const detail: HTMLDivElement = document.createElement('div');
  const term: HTMLElement = document.createElement('dt');
  const description: HTMLElement = document.createElement('dd');

  detail.className = 'country-details__fact';
  term.textContent = label;
  description.textContent = text;
  detail.append(term, description);

  return detail;
}

export function createCountryDetails(
  onClose: () => void,
  getReturnFocus: () => HTMLElement,
): CountryDetails {
  const dialog: HTMLDialogElement = document.createElement('dialog');
  const closeButton: HTMLButtonElement = document.createElement('button');
  const heading: HTMLHeadingElement = document.createElement('h2');
  const description: HTMLParagraphElement = document.createElement('p');
  const facts: HTMLDListElement = document.createElement('dl');

  dialog.className = 'country-details';
  dialog.setAttribute('closedby', 'any');
  dialog.setAttribute('aria-labelledby', DETAILS_TITLE_ID);
  dialog.setAttribute('aria-describedby', DETAILS_DESCRIPTION_ID);
  closeButton.className = 'country-details__close';
  closeButton.type = 'button';
  closeButton.autofocus = true;
  closeButton.textContent = 'Close details';
  heading.id = DETAILS_TITLE_ID;
  heading.className = 'country-details__title';
  description.id = DETAILS_DESCRIPTION_ID;
  description.className = 'country-details__description';
  facts.className = 'country-details__facts';
  dialog.append(closeButton, heading, description, facts);

  closeButton.addEventListener('click', (): void => {
    onClose();
  });

  dialog.addEventListener('cancel', (event: Event): void => {
    event.preventDefault();
    onClose();
  });

  return {
    element: dialog,
    render(country: Country | null): void {
      if (country === null) {
        if (dialog.open) {
          dialog.close();
          getReturnFocus().focus();
        }

        return;
      }

      heading.textContent = country.name;
      description.textContent = country.description || UNAVAILABLE_VALUE;
      facts.replaceChildren(
        createDetail(
          'Area',
          country.area === null
            ? UNAVAILABLE_VALUE
            : `${new Intl.NumberFormat('en').format(country.area)} km²`,
        ),
        createDetail(
          'Borders',
          country.borders.join(', ') || UNAVAILABLE_VALUE,
        ),
        createDetail(
          'Languages',
          country.languages.join(', ') || UNAVAILABLE_VALUE,
        ),
        createDetail(
          'Currencies',
          country.currencies.map(formatCurrency).join('; ') ||
            UNAVAILABLE_VALUE,
        ),
      );

      if (!dialog.open) {
        dialog.showModal();
      }
    },
  };
}
