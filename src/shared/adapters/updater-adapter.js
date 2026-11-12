function resolveTauriGlobals() {
  const tauri = typeof globalThis !== 'undefined' ? globalThis.__TAURI__ : null;
  if (!tauri) {
    return { checkFn: null, getVersionFn: null };
  }

  let checkFn = null;
  if (tauri.updater && typeof tauri.updater.check === 'function') {
    checkFn = tauri.updater.check;
  } else if (tauri.plugins?.updater && typeof tauri.plugins.updater.check === 'function') {
    checkFn = tauri.plugins.updater.check;
  }

  const getVersionFn = tauri.app && typeof tauri.app.getVersion === 'function'
    ? tauri.app.getVersion
    : null;

  return { checkFn, getVersionFn };
}

/**
 * Encapsulates Tauri desktop application version lookup and updater checks.
 */
export function createUpdaterAdapter({ resolveGlobals = resolveTauriGlobals } = {}) {
  async function getAppVersion() {
    const { getVersionFn } = resolveGlobals();
    if (typeof getVersionFn !== 'function') {
      return null;
    }
    return getVersionFn();
  }

  async function checkForUpdate() {
    const { checkFn } = resolveGlobals();
    if (typeof checkFn !== 'function') {
      throw new Error('Plugin updater tidak tersedia (hanya berjalan di aplikasi desktop Tauri).');
    }
    return checkFn();
  }

  return {
    getAppVersion,
    checkForUpdate,
  };
}

export const updaterAdapter = createUpdaterAdapter();

