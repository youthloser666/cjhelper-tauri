import { createModalController } from '../../../shared/ui/modal-controller.js';
import { getElementById } from '../../../shared/utils/dom-helpers.js';

const ALL_BADGE_CLASSES = [
  'wa-badge-connected',
  'wa-badge-qr',
  'wa-badge-starting',
  'wa-badge-disconnected',
];

/**
 * Controls the WhatsApp Server Logs & QR Code modal (`#wa-qr-modal`).
 */
export function mountWaQrModalView({ tauriBridge, onResetComplete, onPollSpeedup }) {
  const modalEl = getElementById('wa-qr-modal');
  const badgeEl = getElementById('wa-modal-status-badge');
  const qrWrapperEl = getElementById('wa-qr-wrapper');
  const qrImgEl = getElementById('wa-qr-img');
  const logsPreEl = getElementById('wa-server-logs');
  const logsContainerEl = getElementById('wa-server-logs-container');
  const closeBtn = getElementById('btn-close-wa-qr');
  const resetBtn = getElementById('btn-modal-wa-reset');

  const modalController = createModalController(modalEl, {
    closeButtonSelector: '#btn-close-wa-qr',
  });

  if (closeBtn) {
    closeBtn.addEventListener('click', () => modalController.close('close-button'));
  }

  if (resetBtn) {
    resetBtn.addEventListener('click', async () => {
      if (!confirm('Apakah Anda yakin ingin me-reset session WhatsApp dan meminta QR Code baru?')) {
        return;
      }

      resetBtn.disabled = true;
      resetBtn.innerHTML = '⏳ Mereset...';

      try {
        await tauriBridge.logoutWhatsApp();
        await onPollSpeedup?.();
        await onResetComplete?.();
      } catch (err) {
        alert(`Gagal me-reset WA: ${err}`);
      } finally {
        resetBtn.disabled = false;
        resetBtn.innerHTML = '<span>🔄 Reset / Scan Ulang</span>';
      }
    });
  }

  function renderSessionState(presentation) {
    if (!presentation) return;

    if (logsPreEl && presentation.logs.length > 0) {
      logsPreEl.textContent = presentation.logs.join('\n');
      if (logsContainerEl) {
        logsContainerEl.scrollTop = logsContainerEl.scrollHeight;
      }
    }

    if (badgeEl) {
      badgeEl.textContent = presentation.status;
      badgeEl.classList.remove(...ALL_BADGE_CLASSES);
      badgeEl.classList.add(presentation.badgeClass);
    }

    if (qrWrapperEl) {
      qrWrapperEl.classList.toggle('is-visible', presentation.showQr);
    }
    if (qrImgEl && presentation.showQr && qrImgEl.src !== presentation.qrUrl) {
      qrImgEl.src = presentation.qrUrl;
    }
  }

  function setStartingState() {
    if (logsPreEl) {
      logsPreEl.textContent = '[SYSTEM] Memulai WhatsApp Server...';
    }
    if (badgeEl) {
      badgeEl.textContent = 'STARTING...';
      badgeEl.classList.remove(...ALL_BADGE_CLASSES);
      badgeEl.classList.add('wa-badge-starting');
    }
  }

  function appendLogLine(line) {
    if (!logsPreEl) return;
    logsPreEl.textContent += `\n${line}`;
  }

  return {
    open: () => modalController.open(),
    close: () => modalController.close(),
    isOpen: () => modalController.isOpen(),
    renderSessionState,
    setStartingState,
    appendLogLine,
  };
}

