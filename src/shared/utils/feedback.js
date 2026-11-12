const activeTimers = new WeakMap();

/**
 * Temporarily flashes feedback text and optional CSS tone class on a button or status label,
 * restoring its prior content automatically without overlapping timers.
 */
export function flashTemporaryFeedback(
  element,
  temporaryMessage,
  {
    durationMs = 2000,
    restoreText = null,
    activeClass = '',
  } = {}
) {
  if (!element) return;

  const existingTimer = activeTimers.get(element);
  if (existingTimer) {
    clearTimeout(existingTimer);
  }

  const originalText = restoreText !== null
    ? restoreText
    : (element.dataset.originalFeedbackText ?? element.textContent);

  if (!element.dataset.originalFeedbackText) {
    element.dataset.originalFeedbackText = originalText;
  }

  element.textContent = temporaryMessage;
  if (activeClass) {
    element.classList.add(activeClass);
  }

  const timerId = setTimeout(() => {
    element.textContent = element.dataset.originalFeedbackText ?? originalText;
    delete element.dataset.originalFeedbackText;
    if (activeClass) {
      element.classList.remove(activeClass);
    }
    activeTimers.delete(element);
  }, durationMs);

  activeTimers.set(element, timerId);
}

