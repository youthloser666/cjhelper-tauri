function resolveDefaultStorage() {
  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage;
  }
  return null;
}

/**
 * Wraps browser localStorage behind safe JSON/string accessors that log warnings
 * and fall back to defaults rather than crashing callers on corrupted data.
 */
export function createStorageAdapter({ backend = resolveDefaultStorage(), logger = console } = {}) {
  function warnFailure(operation, key, error) {
    if (logger && typeof logger.warn === 'function') {
      logger.warn(`[storage] Failed to ${operation} key "${key}":`, error);
    }
  }

  function getString(key, fallback = '') {
    if (!backend || typeof backend.getItem !== 'function') {
      return fallback;
    }

    try {
      const rawValue = backend.getItem(key);
      return rawValue === null || rawValue === undefined ? fallback : String(rawValue);
    } catch (error) {
      warnFailure('read', key, error);
      return fallback;
    }
  }

  function setString(key, value) {
    if (!backend || typeof backend.setItem !== 'function') {
      return false;
    }

    try {
      backend.setItem(key, String(value));
      return true;
    } catch (error) {
      warnFailure('write', key, error);
      return false;
    }
  }

  function getJson(key, fallback = null) {
    const rawValue = getString(key, '');
    if (!rawValue) {
      return fallback;
    }

    try {
      return JSON.parse(rawValue);
    } catch (error) {
      warnFailure('parse JSON for', key, error);
      return fallback;
    }
  }

  function setJson(key, value) {
    try {
      const serialized = JSON.stringify(value);
      return setString(key, serialized);
    } catch (error) {
      warnFailure('serialize JSON for', key, error);
      return false;
    }
  }

  function remove(key) {
    if (!backend || typeof backend.removeItem !== 'function') {
      return false;
    }

    try {
      backend.removeItem(key);
      return true;
    } catch (error) {
      warnFailure('remove', key, error);
      return false;
    }
  }

  return {
    getString,
    setString,
    getJson,
    setJson,
    remove,
  };
}

export const storageAdapter = createStorageAdapter();
