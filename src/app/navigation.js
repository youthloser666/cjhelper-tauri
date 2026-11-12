import { appStore } from '../shared/state/app-store.js';

/**
 * Binds top-level workspace tab navigation and switches panes cleanly.
 */
export function initNavigationController({ onTabActivated } = {}) {
  const navButtons = Array.from(document.querySelectorAll('.nav-btn'));
  const tabPanes = Array.from(document.querySelectorAll('.tab-pane'));

  function activateTab(targetTabId) {
    navButtons.forEach((button) => {
      button.classList.toggle('active', button.dataset.target === targetTabId);
    });
    tabPanes.forEach((pane) => {
      pane.classList.toggle('hidden', pane.id !== targetTabId);
    });

    appStore.setState({ activeTab: targetTabId });
    appStore.emit('navigation:changed', { targetTabId });

    if (typeof onTabActivated === 'function') {
      onTabActivated(targetTabId);
    }
  }

  navButtons.forEach((button) => {
    button.addEventListener('click', () => {
      if (button.dataset.target) {
        activateTab(button.dataset.target);
      }
    });
  });

  return { activateTab };
}

