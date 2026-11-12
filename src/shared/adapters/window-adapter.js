/**
 * Encapsulates Tauri v2 current-window APIs behind an injectable adapter
 * so window chrome behavior remains testable outside a Tauri WebView.
 */
export function createWindowAdapter({
  getCurrentWindow = () => globalThis.__TAURI__?.window?.getCurrentWindow?.() ?? null,
} = {}) {
  function resolveWindow() {
    try {
      return getCurrentWindow?.() ?? null;
    } catch {
      return null;
    }
  }

  return {
    isAvailable: () => Boolean(resolveWindow()),
    startDragging: async () => resolveWindow()?.startDragging?.(),
    minimize: async () => resolveWindow()?.minimize?.(),
    toggleMaximize: async () => resolveWindow()?.toggleMaximize?.(),
    isMaximized: async () => Boolean(await resolveWindow()?.isMaximized?.()),
    close: async () => resolveWindow()?.close?.(),
    onResized: async (handler) => {
      if (typeof handler !== 'function') {
        return () => {};
      }
      const win = resolveWindow();
      if (!win || typeof win.onResized !== 'function') {
        return () => {};
      }
      return win.onResized(handler);
    },
  };
}

export const windowAdapter = createWindowAdapter();

