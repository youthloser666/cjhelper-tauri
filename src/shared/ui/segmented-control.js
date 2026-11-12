/**
 * Binds click switching on a `.segmented-control` container using one listener
 * and invokes `onChange(selectedValue, buttonElement)` whenever a button activates.
 */
export function bindSegmentedControl(containerElement, onChange, { buttonSelector = '.seg-btn' } = {}) {
  if (!containerElement) {
    return () => {};
  }

  function handleClick(event) {
    const clickedButton = event.target.closest(buttonSelector);
    if (!clickedButton || !containerElement.contains(clickedButton)) return;

    const buttons = Array.from(containerElement.querySelectorAll(buttonSelector));
    buttons.forEach((button) => {
      button.classList.toggle('active', button === clickedButton);
    });

    if (typeof onChange === 'function') {
      const selectedValue = clickedButton.dataset.val ?? clickedButton.dataset.value ?? '';
      onChange(selectedValue, clickedButton);
    }
  }

  containerElement.addEventListener('click', handleClick);
  return () => containerElement.removeEventListener('click', handleClick);
}

/**
 * Programmatically highlights the segmented button matching `targetValue`.
 */
export function setSegmentedControlValue(containerElement, targetValue, { buttonSelector = '.seg-btn' } = {}) {
  if (!containerElement) return;

  const buttons = Array.from(containerElement.querySelectorAll(buttonSelector));
  buttons.forEach((button) => {
    const buttonValue = button.dataset.val ?? button.dataset.value ?? '';
    button.classList.toggle('active', buttonValue === targetValue);
  });
}

