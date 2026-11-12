const CLOCK_FORMAT_OPTIONS = Object.freeze({
  weekday: 'long',
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

/**
 * Starts the topbar live `id-ID` clock interval and renders immediately.
 */
export function initClockController() {
  const clockElement = document.getElementById('clock');
  if (!clockElement) {
    return () => {};
  }

  function renderCurrentTime() {
    const now = new Date();
    clockElement.textContent = now.toLocaleDateString('id-ID', CLOCK_FORMAT_OPTIONS);
  }

  renderCurrentTime();
  const intervalId = setInterval(renderCurrentTime, 1000);

  return () => clearInterval(intervalId);
}

