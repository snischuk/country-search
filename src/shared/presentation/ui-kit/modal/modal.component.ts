import './modal.component.css';

export interface Modal {
  readonly element: HTMLDialogElement;
  open(): void;
  close(): void;
}

export function createModal(
  onClose: () => void,
  getReturnFocus: () => HTMLElement,
): Modal {
  const dialog: HTMLDialogElement = document.createElement('dialog');

  dialog.className = 'ui-modal';
  dialog.setAttribute('closedby', 'any');
  dialog.addEventListener('cancel', (event: Event): void => {
    event.preventDefault();
    onClose();
  });

  return {
    element: dialog,
    open(): void {
      if (!dialog.open) {
        dialog.showModal();
      }
    },
    close(): void {
      if (dialog.open) {
        dialog.close();
        getReturnFocus().focus();
      }
    },
  };
}
