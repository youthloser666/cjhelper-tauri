export const WA_POLL_INTERVALS = Object.freeze({
  STARTING: 1000,
  QR_ACTIVE: 1500,
  STEADY: 10000,
});

/**
 * Computes the adaptive polling delay based on WA session state and QR modal visibility.
 */
export function resolveSessionPollInterval({
  status = 'DISCONNECTED',
  isQrModalOpen = false,
  isStarting = false,
} = {}) {
  if (isStarting) {
    return WA_POLL_INTERVALS.STARTING;
  }
  if (status === 'QR_READY' || isQrModalOpen) {
    return WA_POLL_INTERVALS.QR_ACTIVE;
  }
  return WA_POLL_INTERVALS.STEADY;
}

/**
 * Builds the external QR code image URL for a given QR payload string.
 */
export function buildQrCodeImageUrl(qrPayload) {
  if (!qrPayload) return '';
  return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrPayload)}`;
}

/**
 * Maps raw backend wa_status response into pure UI presentation flags and semantic state.
 */
export function getWaSessionPresentation(statusResponse) {
  const status = statusResponse?.status || 'DISCONNECTED';
  const qr = statusResponse?.qr || '';
  const logs = Array.isArray(statusResponse?.logs) ? statusResponse.logs : [];

  if (status === 'CONNECTED') {
    return {
      status,
      headerText: 'CONNECTED',
      badgeClass: 'wa-badge-connected',
      headerToneClass: 'text-grn',
      isOnline: true,
      canSend: true,
      showQr: false,
      qrUrl: '',
      logs,
    };
  }

  if (status === 'QR_READY') {
    return {
      status,
      headerText: 'SCAN QR',
      badgeClass: 'wa-badge-qr',
      headerToneClass: 'text-amb',
      isOnline: false,
      canSend: false,
      showQr: Boolean(qr),
      qrUrl: buildQrCodeImageUrl(qr),
      logs,
    };
  }

  return {
    status,
    headerText: status,
    badgeClass: 'wa-badge-disconnected',
    headerToneClass: 'text-red',
    isOnline: false,
    canSend: false,
    showQr: false,
    qrUrl: '',
    logs,
  };
}

/**
 * Coordinates adaptive polling timers without directly coupling to DOM APIs.
 */
export function createWaSessionPoller({ fetchStatus, isModalOpen, onUpdate, onError }) {
  let currentInterval = WA_POLL_INTERVALS.STEADY;
  let timerId = null;
  let startingMode = false;

  async function tick() {
    try {
      const response = await fetchStatus();
      const status = response?.status || 'DISCONNECTED';
      if (status === 'CONNECTED' || status === 'QR_READY') {
        startingMode = false;
      }

      const nextInterval = resolveSessionPollInterval({
        status,
        isQrModalOpen: Boolean(isModalOpen?.()),
        isStarting: startingMode,
      });
      currentInterval = nextInterval;

      onUpdate?.(getWaSessionPresentation(response));
    } catch (err) {
      startingMode = false;
      onError?.(err);
    } finally {
      scheduleNext(currentInterval);
    }
  }

  function scheduleNext(delayMs) {
    if (timerId !== null) {
      clearTimeout(timerId);
    }
    timerId = setTimeout(() => {
      tick();
    }, delayMs);
  }

  function start(delayOverrideMs = null) {
    if (delayOverrideMs !== null) {
      startingMode = delayOverrideMs <= WA_POLL_INTERVALS.STARTING;
      currentInterval = delayOverrideMs;
    }
    if (timerId !== null) {
      clearTimeout(timerId);
      timerId = null;
    }
    return tick();
  }

  function stop() {
    if (timerId !== null) {
      clearTimeout(timerId);
      timerId = null;
    }
  }

  return {
    start,
    stop,
    checkOnce: tick,
    getCurrentInterval: () => currentInterval,
  };
}

