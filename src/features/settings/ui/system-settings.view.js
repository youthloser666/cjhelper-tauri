import { getElementById, querySelectorAll, setTextContent } from '../../../shared/utils/dom-helpers.js';
import {
  createInitialUpdaterState,
  reduceUpdaterState,
} from '../logic/system-updater-service.js';

const STATUS_TONE_CLASSES = [
  'update-status-text--neutral',
  'update-status-text--accent',
  'update-status-text--success',
  'update-status-text--error',
];

/**
 * Binds subtab navigation inside `#tab-others` and broadcasts `others:subtabChanged` on switch.
 */
export function mountOthersSubnav({ appStore } = {}) {
  const subBtns = querySelectorAll('#tab-others .tb');
  const subPanes = querySelectorAll('#tab-others .subtab-pane');
  const handlers = [];

  for (const btn of subBtns) {
    const onClick = () => {
      for (const b of subBtns) b.classList.remove('active');
      for (const p of subPanes) p.classList.add('hidden');

      btn.classList.add('active');
      const targetId = btn.id.replace('subbtn-', 'subtab-');
      const targetPane = getElementById(targetId);
      if (targetPane) targetPane.classList.remove('hidden');

      appStore?.emit?.('others:subtabChanged', { subtabId: targetId });
    };

    btn.addEventListener('click', onClick);
    handlers.push([btn, onClick]);
  }

  return {
    destroy() {
      for (const [btn, onClick] of handlers) {
        btn.removeEventListener('click', onClick);
      }
    },
  };
}

/**
 * Mounts and controls the System & Updates subtab (`#subtab-system`).
 * Keeps all Tauri updater APIs behind `updaterAdapter`.
 */
export function mountSystemSettingsView({ appStore, updaterAdapter }) {
  const versionDisplay = getElementById('app-version-display');
  const btnCheckUpdate = getElementById('btn-check-update');
  const btnInstallUpdate = getElementById('btn-install-update');
  const statusText = getElementById('update-status-text');
  const progressContainer = getElementById('update-progress-bar-container');
  const progressPercent = getElementById('update-progress-percent');
  const progressFill = getElementById('update-progress-fill');

  let state = createInitialUpdaterState(versionDisplay?.textContent?.trim() || '2.0.4');
  let pendingUpdateHandle = null;

  function render() {
    setTextContent(versionDisplay, state.currentVersion);
    setTextContent(statusText, state.statusMessage);

    if (statusText) {
      statusText.classList.remove(...STATUS_TONE_CLASSES);
      statusText.classList.add(`update-status-text--${state.tone || 'neutral'}`);
    }

    if (btnCheckUpdate) {
      btnCheckUpdate.disabled = state.isChecking || state.isInstalling;
      btnCheckUpdate.textContent = state.isChecking ? '⏳ Mengecek...' : 'Check Updates Now';
    }

    if (btnInstallUpdate) {
      btnInstallUpdate.classList.toggle('hidden', !state.canInstall);
      btnInstallUpdate.disabled = state.isInstalling;
    }

    if (progressContainer) {
      const showProgress = state.status === 'downloading' || state.status === 'restarting';
      progressContainer.classList.toggle('hidden', !showProgress);
    }

    setTextContent(progressPercent, `${state.progressPercent}%`);
    if (progressFill) {
      progressFill.style.width = `${state.progressPercent}%`;
    }
  }

  function dispatch(action) {
    state = reduceUpdaterState(state, action);
    render();
  }

  async function loadVersion() {
    try {
      const version = await updaterAdapter?.getAppVersion?.();
      if (version) {
        dispatch({ type: 'SET_VERSION', version });
      }
    } catch (err) {
      console.warn('Failed to read app version:', err);
    }
  }

  async function handleCheckUpdate() {
    dispatch({ type: 'CHECK_START' });
    try {
      const update = await updaterAdapter.checkForUpdate();
      if (update) {
        pendingUpdateHandle = update;
        dispatch({ type: 'CHECK_AVAILABLE', version: update.version });
      } else {
        pendingUpdateHandle = null;
        dispatch({ type: 'CHECK_UP_TO_DATE' });
      }
    } catch (err) {
      dispatch({ type: 'CHECK_ERROR', error: err });
    }
  }

  async function handleInstallUpdate() {
    if (!pendingUpdateHandle) return;
    dispatch({ type: 'INSTALL_START' });

    try {
      await pendingUpdateHandle.downloadAndInstall((event) => {
        switch (event?.event) {
          case 'Started':
            dispatch({
              type: 'INSTALL_STARTED_EVENT',
              contentLength: event.data?.contentLength,
            });
            break;
          case 'Progress':
            dispatch({
              type: 'INSTALL_PROGRESS_EVENT',
              chunkLength: event.data?.chunkLength,
            });
            break;
          case 'Finished':
            dispatch({ type: 'INSTALL_FINISHED_EVENT' });
            break;
        }
      });
    } catch (err) {
      dispatch({ type: 'INSTALL_ERROR', error: err });
    }
  }

  btnCheckUpdate?.addEventListener('click', handleCheckUpdate);
  btnInstallUpdate?.addEventListener('click', handleInstallUpdate);

  const offSubtab = appStore?.on?.('others:subtabChanged', ({ subtabId }) => {
    if (subtabId === 'subtab-system') {
      loadVersion();
    }
  }) || (() => {});

  render();

  return {
    loadVersion,
    destroy() {
      btnCheckUpdate?.removeEventListener('click', handleCheckUpdate);
      btnInstallUpdate?.removeEventListener('click', handleInstallUpdate);
      offSubtab();
    },
  };
}

