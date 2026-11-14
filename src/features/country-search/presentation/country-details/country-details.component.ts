import { createButton, createModal } from '@/shared/presentation/ui-kit';
import type { Modal } from '@/shared/presentation/ui-kit';

import type { Country } from '../../domain/country.type';
import { UNAVAILABLE_VALUE, formatCurrency } from '../country-search.utility';

import './country-details.component.css';

const DETAILS_TITLE_ID: string = 'country-details-title';
const DETAILS_DESCRIPTION_ID: string = 'country-details-description';

export interface CountryDetails {
  readonly element: HTMLDialogElement;
  render(country: Country | null): void;
}

export function createCountryDetails(
  onClose: () => void,
  getReturnFocus: () => HTMLElement,
): CountryDetails {
  const modal: Modal = createModal(onClose, getReturnFocus);
  const dialog: HTMLDialogElement = modal.element;
  const closeButton: HTMLButtonElement = createButton({
    label: 'Close details',
  });
  const heading: HTMLHeadingElement = document.createElement('h2');
  const description: HTMLParagraphElement = document.createElement('p');
  const facts: HTMLDListElement = document.createElement('dl');

  dialog.classList.add('country-details');
  dialog.setAttribute('aria-labelledby', DETAILS_TITLE_ID);
  dialog.setAttribute('aria-describedby', DETAILS_DESCRIPTION_ID);
  closeButton.classList.add('country-details__close');
  closeButton.autofocus = true;
  heading.id = DETAILS_TITLE_ID;
  heading.className = 'country-details__title';
  description.id = DETAILS_DESCRIPTION_ID;
  description.className = 'country-details__description';
  facts.className = 'country-details__facts';
  dialog.append(closeButton, heading, description, facts);

  closeButton.addEventListener('click', (): void => {
    onClose();
  });

  return {
    element: dialog,
    render(country: Country | null): void {
      if (country === null) {
        modal.close();

        return;
      }

      heading.textContent = country.name;
      description.textContent = country.description || UNAVAILABLE_VALUE;
      const details: { label: string; text: string }[] = [
        {
          label: 'Area',
          text:
            country.area === null
              ? UNAVAILABLE_VALUE
              : `${new Intl.NumberFormat('en').format(country.area)} km²`,
        },
        {
          label: 'Borders',
          text: country.borders.join(', ') || UNAVAILABLE_VALUE,
        },
        {
          label: 'Languages',
          text: country.languages.join(', ') || UNAVAILABLE_VALUE,
        },
        {
          label: 'Currencies',
          text:
            country.currencies.map(formatCurrency).join('; ') ||
            UNAVAILABLE_VALUE,
        },
      ];

      facts.replaceChildren();
      details.forEach((fact: { label: string; text: string }): void => {
        const row: HTMLDivElement = document.createElement('div');
        const label: HTMLElement = document.createElement('dt');
        const text: HTMLElement = document.createElement('dd');

        row.className = 'country-details__fact';
        label.textContent = fact.label;
        text.textContent = fact.text;
        row.append(label, text);
        facts.append(row);
      });

      modal.open();
    },
  };
}
