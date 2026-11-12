import { appStore } from '../shared/state/app-store.js';

/**
 * Controls light/dark body theme class switching and emits theme change events.
 */
export function initThemeController({ onThemeChanged } = {}) {
  const themeButton = document.getElementById('btn-theme');

  function applyThemeState(isLight) {
    document.body.classList.toggle('light', isLight);
    document.body.classList.toggle('dark', !isLight);
    if (themeButton) {
      const label = isLight ? 'Switch to dark mode' : 'Switch to light mode';
      themeButton.textContent = isLight ? '◑' : '◐';
      themeButton.setAttribute?.('aria-label', label);
      themeButton.title = label;
    }
    appStore.setState({ theme: isLight ? 'light' : 'dark' });
    appStore.emit('theme:changed', { isLight });

    if (typeof onThemeChanged === 'function') {
      onThemeChanged(isLight);
    }
  }

  themeButton?.addEventListener('click', () => {
    const nextIsLight = !document.body.classList.contains('light');
    applyThemeState(nextIsLight);
  });

  applyThemeState(appStore.getState('theme') === 'light');

  return {
    isLightTheme: () => document.body.classList.contains('light'),
    setLightTheme: applyThemeState,
  };
}

