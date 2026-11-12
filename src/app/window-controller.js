import { windowAdapter as defaultWindowAdapter } from '../shared/adapters/window-adapter.js';

const INTERACTIVE_TARGET_SELECTOR = 'button, a, input, select, textarea, [data-no-drag]';

function isInteractiveTarget(target) {
  return typeof target?.closest === 'function' && Boolean(target.closest(INTERACTIVE_TARGET_SELECTOR));
}

function applyMaximizeButtonState(maxBtn, isMaximized) {
  if (!maxBtn) return;
  const maximized = Boolean(isMaximized);
  const label = maximized ? 'Restore window' : 'Maximize window';
  maxBtn.dataset.maximized = maximized ? 'true' : 'false';
  maxBtn.setAttribute?.('data-maximized', maxBtn.dataset.maximized);
  maxBtn.setAttribute?.('aria-label', label);
  maxBtn.title = maximized ? 'Restore' : 'Maximize';
}

/**
 * Initializes custom frameless header window dragging, double-click maximize,
 * and Minimize / Maximize-Restore / Close window controls.
 */
export function initWindowController({ windowAdapter = defaultWindowAdapter } = {}) {
  const titlebar = document.getElementById('app-titlebar');
  const minBtn = document.getElementById('btn-win-min');
  const maxBtn = document.getElementById('btn-win-max');
  const closeBtn = document.getElementById('btn-win-close');

  const cleanups = [];
  let unlistenResized = null;
  let destroyed = false;

  async function syncMaximizeState() {
    if (destroyed || !maxBtn) return false;
    try {
      const maximized = await windowAdapter.isMaximized?.();
      if (!destroyed) {
        applyMaximizeButtonState(maxBtn, maximized);
      }
      return Boolean(maximized);
    } catch {
      return false;
    }
  }

  async function handleToggleMaximize() {
    await windowAdapter.toggleMaximize?.();
    await syncMaximizeState();
  }

  const buttonBindings = [
    [minBtn, () => windowAdapter.minimize?.()],
    [maxBtn, handleToggleMaximize],
    [closeBtn, () => windowAdapter.close?.()],
  ];

  buttonBindings.forEach(([button, handler]) => {
    if (!button) return;
    button.addEventListener('click', handler);
    cleanups.push(() => button.removeEventListener('click', handler));
  });

  if (titlebar) {
    const handleMouseDown = (event) => {
      if (event.button !== 0 || (event.detail ?? 1) > 1) return;
      if (isInteractiveTarget(event.target)) return;
      windowAdapter.startDragging?.();
    };

    const handleDblClick = (event) => {
      if (isInteractiveTarget(event.target)) return;
      handleToggleMaximize();
    };

    titlebar.addEventListener('mousedown', handleMouseDown);
    titlebar.addEventListener('dblclick', handleDblClick);
    cleanups.push(() => {
      titlebar.removeEventListener('mousedown', handleMouseDown);
      titlebar.removeEventListener('dblclick', handleDblClick);
    });
  }

  const ready = (async () => {
    await syncMaximizeState();
    if (destroyed) return;
    try {
      const unlisten = await windowAdapter.onResized?.(() => {
        void syncMaximizeState();
      });
      if (typeof unlisten === 'function') {
        if (destroyed) {
          unlisten();
        } else {
          unlistenResized = unlisten;
        }
      }
    } catch {
      // Safe fallback outside Tauri desktop runtime.
    }
  })();

  return {
    ready,
    syncMaximizeState,
    destroy: () => {
      destroyed = true;
      cleanups.forEach((cleanup) => cleanup());
      if (typeof unlistenResized === 'function') {
        unlistenResized();
        unlistenResized = null;
      }
    },
  };
}

