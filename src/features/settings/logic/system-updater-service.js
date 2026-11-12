/**
 * Creates the initial UI/business state for the System & Auto Update subtab.
 *
 * @param {string} [currentVersion]
 */
export function createInitialUpdaterState(currentVersion = '2.0.4') {
  return {
    status: 'idle',
    currentVersion: String(currentVersion || '2.0.4'),
    availableVersion: null,
    statusMessage: 'Click button below to check for updates',
    tone: 'neutral',
    canInstall: false,
    isChecking: false,
    isInstalling: false,
    progressPercent: 0,
    downloadedBytes: 0,
    contentLength: 0,
    errorMessage: '',
  };
}

/**
 * Pure state transition reducer for Tauri updater checks, downloads, and errors.
 *
 * @param {ReturnType<typeof createInitialUpdaterState>} state
 * @param {{ type: string, version?: string, contentLength?: number, chunkLength?: number, error?: unknown }} action
 */
export function reduceUpdaterState(state, action = {}) {
  switch (action.type) {
    case 'SET_VERSION':
      return {
        ...state,
        currentVersion: String(action.version || state.currentVersion),
      };

    case 'CHECK_START':
      return {
        ...state,
        status: 'checking',
        isChecking: true,
        canInstall: false,
        statusMessage: 'Sedang mencari update terbaru...',
        tone: 'neutral',
        errorMessage: '',
      };

    case 'CHECK_AVAILABLE':
      return {
        ...state,
        status: 'available',
        isChecking: false,
        canInstall: true,
        availableVersion: String(action.version || ''),
        statusMessage: `🚀 Versi baru tersedia: ${action.version}`,
        tone: 'accent',
      };

    case 'CHECK_UP_TO_DATE':
      return {
        ...state,
        status: 'up_to_date',
        isChecking: false,
        canInstall: false,
        availableVersion: null,
        statusMessage: '✅ Anda sudah menggunakan versi terbaru.',
        tone: 'success',
      };

    case 'CHECK_ERROR': {
      const msg = String(action.error?.message ?? action.error ?? 'Unknown error');
      return {
        ...state,
        status: 'error',
        isChecking: false,
        isInstalling: false,
        errorMessage: msg,
        statusMessage: `❌ Gagal mengecek update: ${msg}`,
        tone: 'error',
      };
    }

    case 'INSTALL_START':
      return {
        ...state,
        status: 'downloading',
        isInstalling: true,
        progressPercent: 0,
        downloadedBytes: 0,
        contentLength: 0,
        statusMessage: 'Mengunduh update...',
        tone: 'accent',
        errorMessage: '',
      };

    case 'INSTALL_STARTED_EVENT':
      return {
        ...state,
        contentLength: Number(action.contentLength) || 0,
      };

    case 'INSTALL_PROGRESS_EVENT': {
      const nextDownloaded = state.downloadedBytes + (Number(action.chunkLength) || 0);
      const nextPercent = state.contentLength > 0
        ? Math.min(100, Math.round((nextDownloaded / state.contentLength) * 100))
        : state.progressPercent;
      return {
        ...state,
        downloadedBytes: nextDownloaded,
        progressPercent: nextPercent,
      };
    }

    case 'INSTALL_FINISHED_EVENT':
      return {
        ...state,
        status: 'restarting',
        isInstalling: false,
        progressPercent: 100,
        statusMessage: 'Update berhasil diinstal! Restarting...',
        tone: 'success',
      };

    case 'INSTALL_ERROR': {
      const msg = String(action.error?.message ?? action.error ?? 'Unknown error');
      return {
        ...state,
        status: 'error',
        isInstalling: false,
        errorMessage: msg,
        statusMessage: `❌ Gagal menginstal update: ${msg}`,
        tone: 'error',
      };
    }

    default:
      return state;
  }
}

