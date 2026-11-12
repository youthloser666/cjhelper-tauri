import { createModalController } from '../../../shared/ui/modal-controller.js';
import { bindSegmentedControl, setSegmentedControlValue } from '../../../shared/ui/segmented-control.js';
import { getElementById, setTextContent } from '../../../shared/utils/dom-helpers.js';
import {
  buildExternalStreetViewUrl,
  buildStreetViewEmbedUrl,
  normalizeStreetViewCoords,
} from '../logic/street-view-service.js';

/**
 * Mounts and controls the Street View / Satellite preview modal (`#modal-street-view`).
 * Eliminates all inline handlers and global `window.openStreetViewPopup` leaks.
 */
export function mountStreetViewModalView({ tauriBridge }) {
  const modalEl = getElementById('modal-street-view');
  if (!modalEl) {
    return { open: () => {}, close: () => {}, destroy: () => {} };
  }

  const titleEl = getElementById('sv-modal-title');
  const coordsEl = getElementById('sv-modal-coords');
  const modeGroup = getElementById('sv-mode-group');
  const btnOpenExternal = getElementById('btn-sv-open-external');
  const btnErrorExternal = getElementById('btn-sv-error-external');
  const iframeEl = getElementById('sv-iframe');
  const loaderEl = getElementById('sv-iframe-loader');
  const errorEl = getElementById('sv-iframe-error');

  let currentCoords = null;
  let currentMode = 'pano';

  function loadIframe(mode) {
    if (!currentCoords || !iframeEl) return;
    currentMode = mode === 'sat' ? 'sat' : 'pano';
    setSegmentedControlValue(modeGroup, currentMode);

    if (errorEl) errorEl.classList.add('hidden');
    if (loaderEl) loaderEl.classList.remove('hidden');

    iframeEl.src = buildStreetViewEmbedUrl(currentCoords.lat, currentCoords.lon, currentMode);
  }

  function handleIframeLoad() {
    if (loaderEl) loaderEl.classList.add('hidden');
  }

  function handleIframeError() {
    if (loaderEl) loaderEl.classList.add('hidden');
    if (errorEl) errorEl.classList.remove('hidden');
  }

  async function openExternal() {
    if (!currentCoords) return;
    const url = buildExternalStreetViewUrl(currentCoords.lat, currentCoords.lon);
    try {
      await tauriBridge.openExternalUrl(url);
    } catch (err) {
      console.warn('Failed to open external Street View URL:', err);
    }
  }

  iframeEl?.addEventListener('load', handleIframeLoad);
  iframeEl?.addEventListener('error', handleIframeError);
  btnOpenExternal?.addEventListener('click', openExternal);
  btnErrorExternal?.addEventListener('click', openExternal);

  const unbindSeg = bindSegmentedControl(modeGroup, (selectedMode) => {
    loadIframe(selectedMode);
  });

  const modalController = createModalController(modalEl, {
    onClose() {
      if (iframeEl) iframeEl.src = 'about:blank';
      if (loaderEl) loaderEl.classList.add('hidden');
      if (errorEl) errorEl.classList.add('hidden');
    },
  });

  function open(lat, lon, title = '') {
    const normalized = normalizeStreetViewCoords(lat, lon, title);
    if (!normalized) return;

    currentCoords = normalized;
    setTextContent(titleEl, normalized.title);
    setTextContent(coordsEl, normalized.coordsLabel);
    modalController.open();
    loadIframe('pano');
  }

  return {
    open,
    close: () => modalController.close(),
    destroy() {
      unbindSeg();
      iframeEl?.removeEventListener('load', handleIframeLoad);
      iframeEl?.removeEventListener('error', handleIframeError);
      btnOpenExternal?.removeEventListener('click', openExternal);
      btnErrorExternal?.removeEventListener('click', openExternal);
      modalController.destroy();
    },
  };
}

