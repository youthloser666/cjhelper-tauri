import { bindSegmentedControl } from '../../../shared/ui/segmented-control.js';
import { escapeHtml, getElementById } from '../../../shared/utils/dom-helpers.js';
import { flashTemporaryFeedback } from '../../../shared/utils/feedback.js';
import { loadFormatConfig } from '../../messages/logic/format-config.js';
import {
  appendBroadcastLog,
  formatBroadcastLogsDisplay,
  getTodayLogDateString,
  loadBroadcastLogs,
} from '../logic/broadcast-log-service.js';
import { generateShareBroadcastMessage } from '../logic/te-message-generator.js';
import {
  WA_POLL_INTERVALS,
  createWaSessionPoller,
} from '../logic/wa-session-service.js';

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Controls the WhatsApp Broadcast tab (`#tab-wa`), session polling, target groups, and logs.
 */
export function mountWhatsAppBroadcastView({
  appStore,
  tauriBridge,
  storageAdapter,
  clipboardAdapter,
  qrModalView,
  filterState,
}) {
  const regionSeg = getElementById('wa-region-seg');
  const statusDot = getElementById('srv-dot-indicator');
  const statusTextEl = getElementById('wa-status-text');
  const btnWaStatus = getElementById('btn-wa-status');
  const btnWaStart = getElementById('btn-wa-start');
  const btnWaReset = getElementById('btn-wa-reset');
  const chkNetdrone = getElementById('chk-wa-enable-netdrone');
  const btnGenWa = getElementById('btn-gen-wa');
  const txtPreview = getElementById('txt-wa-preview');
  const charCountEl = getElementById('wa-char-count');
  const btnCopyWa = getElementById('btn-copy-wa');
  const targetCountEl = getElementById('wa-target-count');
  const targetsTbody = getElementById('wa-targets-tbody');
  const btnWaSend = getElementById('btn-wa-send');
  const logDateMain = getElementById('wa-bc-log-date-main');
  const logBoxMain = getElementById('wa-bc-log-box-main');

  const progressContainer = getElementById('wa-bc-progress-container');
  const progressStatus = getElementById('wa-bc-progress-status');
  const progressPercent = getElementById('wa-bc-progress-percent');
  const progressFill = getElementById('wa-bc-progress-fill');
  const btnCloseFloating = getElementById('btn-close-bc-floating');

  let waRegion = 'CJN';
  let hideProgressTimer = null;
  let broadcastLogs = loadBroadcastLogs(storageAdapter);

  function setStatusIndicatorOnline(isOnline) {
    if (!statusDot) return;
    statusDot.classList.toggle('srv-on', Boolean(isOnline));
    statusDot.classList.toggle('srv-off', !isOnline);
  }

  function applySessionPresentation(presentation) {
    if (!presentation) return;

    if (statusTextEl) {
      statusTextEl.textContent = presentation.headerText;
      statusTextEl.classList.remove('text-grn', 'text-amb', 'text-red');
      statusTextEl.classList.add(presentation.headerToneClass);
    }

    setStatusIndicatorOnline(presentation.isOnline);
    if (btnWaSend) {
      btnWaSend.disabled = !presentation.canSend;
    }

    qrModalView.renderSessionState(presentation);
    appStore.setState({ waServerStatus: presentation.status });
  }

  const sessionPoller = createWaSessionPoller({
    fetchStatus: () => tauriBridge.getWhatsAppStatus(),
    isModalOpen: () => qrModalView.isOpen(),
    onUpdate: applySessionPresentation,
    onError: () => {
      if (statusTextEl) {
        statusTextEl.textContent = 'DISCONNECTED';
        statusTextEl.classList.remove('text-grn', 'text-amb');
        statusTextEl.classList.add('text-red');
      }
      setStatusIndicatorOnline(false);
      if (btnWaSend) btnWaSend.disabled = true;
    },
  });

  if (regionSeg) {
    bindSegmentedControl(
      regionSeg,
      (nextVal) => {
        waRegion = nextVal || 'CJN';
      },
      { buttonSelector: '.pill' }
    );
  }

  if (chkNetdrone) {
    chkNetdrone.checked = Boolean(filterState.config.enableNetdrone);
    chkNetdrone.addEventListener('change', () => {
      btnGenWa?.click();
    });
  }

  function updateCharCount() {
    if (!txtPreview || !charCountEl) return;
    const value = txtPreview.value || '';
    const lines = value ? value.split('\n').length : 0;
    charCountEl.textContent = `${value.length} karakter | ${lines} baris`;
  }

  if (txtPreview) {
    txtPreview.addEventListener('input', updateCharCount);
  }

  async function generateSharePreview() {
    try {
      const statuses = await tauriBridge.checkSiteStatus();
      const state = appStore.getState();
      const formatConfig = loadFormatConfig(storageAdapter, 'bc');
      const waText = generateShareBroadcastMessage(statuses, {
        region: waRegion,
        formatConfig,
        netdroneData: state.netdroneData || [],
        pivotData: state.pivotData || [],
        enableNetdrone: chkNetdrone ? chkNetdrone.checked : false,
      });

      if (txtPreview) {
        txtPreview.value = waText;
        updateCharCount();
      }
    } catch (err) {
      console.error('Failed generating WA share text:', err);
    }
  }

  if (btnGenWa) {
    btnGenWa.addEventListener('click', generateSharePreview);
  }

  if (btnCopyWa) {
    btnCopyWa.addEventListener('click', async () => {
      const value = txtPreview?.value || '';
      if (!value) return;
      await clipboardAdapter.writeText(value);
      flashTemporaryFeedback(btnCopyWa, '✓ Copied!');
    });
  }

  function updateTargetCount() {
    if (!targetCountEl) return;
    const count = document.querySelectorAll('.wa-target-chk:checked').length;
    targetCountEl.textContent = `${count} grup terpilih`;
  }

  function renderWaTargets(savedGroups = []) {
    if (!targetsTbody) return;
    targetsTbody.innerHTML = '';

    if (!Array.isArray(savedGroups) || savedGroups.length === 0) {
      targetsTbody.innerHTML =
        '<tr><td class="text-center text-subtle py-4">Belum ada grup disimpan.<br><small>Atur di Broadcast Utils</small></td></tr>';
      if (targetCountEl) targetCountEl.textContent = '0 grup terpilih';
      return;
    }

    for (const group of savedGroups) {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="text-center col-w-40">
          <input type="checkbox" class="wa-target-chk checkbox" data-id="${escapeHtml(group.group_id)}" data-name="${escapeHtml(group.group_name)}" checked>
        </td>
        <td class="text-sm font-bold text-success">${escapeHtml(group.group_name)}</td>
      `;

      const chk = tr.querySelector('input');
      tr.addEventListener('click', (e) => {
        if (e.target.tagName !== 'INPUT') {
          chk.checked = !chk.checked;
          updateTargetCount();
        }
      });
      chk.addEventListener('change', updateTargetCount);
      targetsTbody.appendChild(tr);
    }

    updateTargetCount();
  }

  function renderMainLogs(logs) {
    if (logDateMain) {
      logDateMain.textContent = `📋 ${getTodayLogDateString()}`;
    }
    if (logBoxMain) {
      logBoxMain.value = formatBroadcastLogsDisplay(logs);
    }
  }

  function syncBroadcastLogs(logs) {
    broadcastLogs = logs;
    appStore.setState({ waBroadcastLogs: logs });
    renderMainLogs(logs);
    appStore.emit('whatsapp:logsUpdated', logs);
  }

  if (btnWaStatus) {
    btnWaStatus.addEventListener('click', () => {
      qrModalView.open();
      sessionPoller.checkOnce();
    });
  }

  if (btnWaStart) {
    btnWaStart.addEventListener('click', async () => {
      try {
        qrModalView.open();
        qrModalView.setStartingState();
        if (statusTextEl) statusTextEl.textContent = 'Checking...';

        let isActive = false;
        try {
          const check = await tauriBridge.getWhatsAppStatus();
          if (check) {
            isActive = true;
            if (check.status === 'DISCONNECTED') {
              await tauriBridge.logoutWhatsApp().catch(() => {});
            }
          }
        } catch {
          // Server not yet running
        }

        if (isActive) {
          if (statusTextEl) {
            statusTextEl.textContent = 'Server already active!';
            statusTextEl.classList.remove('text-red', 'text-amb');
            statusTextEl.classList.add('text-grn');
          }
          await sessionPoller.checkOnce();
          return;
        }

        if (statusTextEl) statusTextEl.textContent = 'Starting...';
        sessionPoller.start(WA_POLL_INTERVALS.STARTING);

        await tauriBridge.startWhatsAppServer();
        if (statusTextEl) {
          statusTextEl.textContent = 'Server node started!';
          statusTextEl.classList.remove('text-red', 'text-amb');
          statusTextEl.classList.add('text-grn');
        }
      } catch (err) {
        if (statusTextEl) {
          statusTextEl.textContent = `Error: ${err}`;
          statusTextEl.classList.remove('text-grn', 'text-amb');
          statusTextEl.classList.add('text-red');
        }
        qrModalView.appendLogLine(`[ERROR] Gagal memanggil wa_start_server: ${err}`);
      }
    });
  }

  if (btnWaReset) {
    btnWaReset.addEventListener('click', async () => {
      if (
        !confirm(
          'Apakah Anda yakin ingin me-reset koneksi / logout WhatsApp? Session akan dihapus dan Anda perlu melakukan scan QR code kembali.'
        )
      ) {
        return;
      }

      const oldText = btnWaReset.innerHTML;
      try {
        if (statusTextEl) statusTextEl.textContent = 'Resetting...';
        btnWaReset.disabled = true;
        btnWaReset.innerHTML = '⏳ ...';

        await tauriBridge.logoutWhatsApp();

        if (statusTextEl) {
          statusTextEl.textContent = 'LOGGED OUT';
          statusTextEl.classList.remove('text-grn', 'text-amb');
          statusTextEl.classList.add('text-red');
        }
        alert('WhatsApp session berhasil di-logout / reset!');
        await sessionPoller.checkOnce();
      } catch (err) {
        alert(`Gagal me-reset WA: ${err}`);
      } finally {
        btnWaReset.innerHTML = oldText;
        btnWaReset.disabled = false;
      }
    });
  }

  if (btnCloseFloating && progressContainer) {
    btnCloseFloating.addEventListener('click', () => {
      progressContainer.classList.remove('open');
    });
  }

  if (btnWaSend) {
    btnWaSend.addEventListener('click', async () => {
      const waText = txtPreview?.value.trim() || '';
      if (!waText) {
        alert('Pesan kosong. Generate dulu.');
        return;
      }

      const selected = Array.from(document.querySelectorAll('.wa-target-chk:checked')).map(
        (chk) => ({
          group_id: chk.dataset.id,
          group_name: chk.dataset.name,
        })
      );

      if (selected.length === 0) {
        alert('Tidak ada grup yang dicentang.');
        return;
      }

      const confirmMsg =
        `Kirim pesan ke ${selected.length} grup?\n\n` +
        selected.map((g) => `• ${g.group_name}`).join('\n');
      if (!confirm(confirmMsg)) {
        return;
      }

      if (hideProgressTimer) {
        clearTimeout(hideProgressTimer);
        hideProgressTimer = null;
      }

      btnWaSend.disabled = true;
      btnWaSend.textContent = 'MENGIRIM...';

      if (progressContainer) {
        progressContainer.classList.remove('is-done');
        progressContainer.classList.add('open');
      }

      let totalSuccess = 0;

      try {
        for (let idx = 0; idx < selected.length; idx += 1) {
          const group = selected[idx];
          const pct = Math.round(((idx + 1) / selected.length) * 100);
          if (progressStatus) {
            progressStatus.textContent = `⏳ Mengirim (${idx + 1}/${selected.length}): ${group.group_name}`;
          }
          if (progressPercent) progressPercent.textContent = `${pct}%`;
          if (progressFill) progressFill.style.width = `${pct}%`;

          try {
            const broadcastResponse = await tauriBridge.broadcastWhatsApp({
              targets: [{ group_id: group.group_id, message: waText }],
              delay_ms: 1500,
            });
            totalSuccess += broadcastResponse?.success || 0;
          } catch (err) {
            console.error(`Gagal mengirim ke ${group.group_name}:`, err);
          }

          if (idx < selected.length - 1) {
            await delay(1000);
          }
        }

        if (progressStatus) {
          progressStatus.textContent = `✅ Broadcast Selesai: ${totalSuccess}/${selected.length} berhasil!`;
        }
        if (progressPercent) progressPercent.textContent = '100%';
        if (progressFill) progressFill.style.width = '100%';
        if (progressContainer) progressContainer.classList.add('is-done');

        const nextLogs = appendBroadcastLog(storageAdapter, broadcastLogs, {
          success: totalSuccess,
          total: selected.length,
          groups: selected.map((g) => g.group_name),
        });
        syncBroadcastLogs(nextLogs);

        hideProgressTimer = setTimeout(() => {
          if (progressContainer) {
            progressContainer.classList.remove('open', 'is-done');
          }
        }, 7000);
      } catch (err) {
        alert(`Error Broadcast: ${err}`);
      } finally {
        btnWaSend.disabled = false;
        btnWaSend.textContent = 'KIRIM BROADCAST';
      }
    });
  }

  const unsubSavedGroups = appStore.subscribe('waSavedGroups', (groups) => {
    renderWaTargets(groups || []);
  });

  const offRefreshTab = appStore.on('navigation:changed', ({ targetTabId }) => {
    if (targetTabId === 'tab-wa') {
      generateSharePreview();
    }
  });

  renderWaTargets(appStore.getState('waSavedGroups') || []);
  renderMainLogs(broadcastLogs);
  appStore.setState({ waBroadcastLogs: broadcastLogs });
  sessionPoller.start();

  return {
    pollNow: () => sessionPoller.checkOnce(),
    speedUpPoll: () => sessionPoller.start(WA_POLL_INTERVALS.STARTING),
    generateSharePreview,
    destroy: () => {
      sessionPoller.stop();
      unsubSavedGroups();
      offRefreshTab();
    },
  };
}
