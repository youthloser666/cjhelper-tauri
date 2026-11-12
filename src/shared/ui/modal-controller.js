/**
 * Creates a standardized modal lifecycle controller supporting explicit open/close,
 * close buttons, backdrop clicks, and Escape key dismissal.
 */
export function createModalController(modalElement, {
  closeButtonSelector = '.modal-close-trigger',
  onOpen = null,
  onClose = null,
  closeOnBackdrop = true,
  closeOnEscape = true,
} = {}) {
  if (!modalElement) {
    return {
      open: () => {},
      close: () => {},
      isOpen: () => false,
      destroy: () => {},
    };
  }

  function isOpen() {
    return modalElement.classList.contains('open');
  }

  function open(payload) {
    modalElement.classList.add('open');
    if (typeof onOpen === 'function') {
      onOpen(payload);
    }
  }

  function close(reason = 'manual') {
    if (!isOpen()) return;
    modalElement.classList.remove('open');
    if (typeof onClose === 'function') {
      onClose(reason);
    }
  }

  function handleModalClick(event) {
    if (closeOnBackdrop && event.target === modalElement) {
      close('backdrop');
      return;
    }

    if (closeButtonSelector && event.target.closest(closeButtonSelector)) {
      close('close-button');
    }
  }

  function handleDocumentKeydown(event) {
    if (closeOnEscape && event.key === 'Escape' && isOpen()) {
      close('escape');
    }
  }

  modalElement.addEventListener('click', handleModalClick);
  document.addEventListener('keydown', handleDocumentKeydown);

  return {
    open,
    close,
    isOpen,
    destroy() {
      modalElement.removeEventListener('click', handleModalClick);
      document.removeEventListener('keydown', handleDocumentKeydown);
    },
  };
}

