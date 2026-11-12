const DEFAULT_APP_STATE = Object.freeze({
  activeTab: 'dashboard',
  theme: 'dark',
  activeRegionFilter: 'ALL',
  statusData: [],
  pivotData: [],
  netdroneData: [],
  flashMasterData: [],
  waGroups: [],
  waSavedGroups: [],
  waTeContacts: [],
  waServerStatus: { connected: false, status: 'stopped', qr: '', logs: [] },
  lastDbRow: null,
  databaseLoad: Object.freeze({
    status: 'idle',
    fileName: '',
    rowCount: 0,
    errorMessage: '',
  }),
  siteChanges: { updated_at: null, overrides: {}, handovers: [] },
});

/**
 * Creates a lightweight reactive store and cross-feature event bus.
 * Keeps shared application state centralized without third-party dependencies.
 */
export function createAppStore(initialOverrides = {}) {
  const state = {
    ...DEFAULT_APP_STATE,
    ...initialOverrides,
  };

  const sliceListeners = new Map();
  const eventListeners = new Map();

  function getState(sliceKey) {
    if (sliceKey === undefined) {
      return { ...state };
    }
    return state[sliceKey];
  }

  function setState(patch) {
    if (!patch || typeof patch !== 'object') return;

    for (const [sliceKey, nextValue] of Object.entries(patch)) {
      const previousValue = state[sliceKey];
      if (Object.is(previousValue, nextValue)) continue;

      state[sliceKey] = nextValue;
      const listeners = sliceListeners.get(sliceKey);
      if (listeners) {
        for (const listener of listeners) {
          listener(nextValue, previousValue);
        }
      }
    }
  }

  function subscribe(sliceKey, listener) {
    if (typeof listener !== 'function') {
      return () => {};
    }

    if (!sliceListeners.has(sliceKey)) {
      sliceListeners.set(sliceKey, new Set());
    }
    const listeners = sliceListeners.get(sliceKey);
    listeners.add(listener);

    return () => {
      listeners.delete(listener);
    };
  }

  function on(eventName, listener) {
    if (typeof listener !== 'function') {
      return () => {};
    }

    if (!eventListeners.has(eventName)) {
      eventListeners.set(eventName, new Set());
    }
    const listeners = eventListeners.get(eventName);
    listeners.add(listener);

    return () => {
      listeners.delete(listener);
    };
  }

  function emit(eventName, payload) {
    const listeners = eventListeners.get(eventName);
    if (!listeners) return;

    for (const listener of listeners) {
      listener(payload);
    }
  }

  return {
    getState,
    setState,
    subscribe,
    on,
    emit,
  };
}

export const appStore = createAppStore();

