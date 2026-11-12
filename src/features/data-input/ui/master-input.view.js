import { tauriBridge } from '../../../shared/adapters/tauri-bridge.js';
import { appStore } from '../../../shared/state/app-store.js';
import { bindSegmentedControl } from '../../../shared/ui/segmented-control.js';
import { formatMasterProcessFeedback, shouldTriggerAutoSnapshot } from '../logic/master-table-service.js';

/**
 * Manages Data Input sub-tabs, Master Table paste parsing, snapshots, and auto-snapshot schedule.
 */
export function initMasterInputView({
  onResetDependentData = null,
  onStatusReloadRequired = null,
} = {}) {
  const subtabSegmented = document.getElementById('datatable-subtab-seg');
  const masterTextarea = document.getElementById('txt-master');
  const processButton = document.getElementById('btn-process');
  const clearButton = document.getElementById('btn-clear');
  const resetSnapshotButton = document.getElementById('btn-reset-snap');
  const manualSnapshotButton = document.getElementById('btn-manual-snap');
  const statusBar = document.getElementById('status-bar');
  const snapshotLabel = document.getElementById('lbl-snapshot');
  const dashboardMasterCount = document.getElementById('dash-master');

  bindSegmentedControl(subtabSegmented, (_selectedValue, clickedButton) => {
    const targetSubtabId = clickedButton?.dataset?.subtarget;
    document.querySelectorAll('.dt-subtab-pane').forEach((pane) => pane.classList.add('hidden'));
    const targetPane = targetSubtabId ? document.getElementById(targetSubtabId) : null;
    if (targetPane) targetPane.classList.remove('hidden');
  });

  processButton?.addEventListener('click', async () => {
    const pastedText = (masterTextarea?.value || '').trim();
    if (!pastedText) {
      if (statusBar) statusBar.textContent = 'Data kosong.';
      return;
    }

    onResetDependentData?.();
    if (statusBar) statusBar.textContent = 'Memproses data...';

    try {
      const parseResult = await tauriBridge.parsePastedTable(pastedText);
      if (dashboardMasterCount) dashboardMasterCount.textContent = parseResult.count;

      const timeLabel = new Date().toLocaleTimeString('id-ID');
      const feedback = formatMasterProcessFeedback(parseResult, timeLabel);
      if (feedback.snapshotText && snapshotLabel) {
        snapshotLabel.textContent = feedback.snapshotText;
      }
      if (statusBar) statusBar.textContent = feedback.statusText;

      await onStatusReloadRequired?.();
    } catch (error) {
      if (statusBar) statusBar.textContent = `Error: ${error}`;
    }
  });

  resetSnapshotButton?.addEventListener('click', async () => {
    try {
      await tauriBridge.resetDataSnapshot();
      await tauriBridge.clearWorkspaceData();
      if (masterTextarea) masterTextarea.value = '';
      if (dashboardMasterCount) dashboardMasterCount.textContent = '0';
      onResetDependentData?.();

      if (snapshotLabel) {
        snapshotLabel.textContent = 'Direset — proses berikutnya akan dipakai sebagai baseline';
        snapshotLabel.className = 'text-warning ml-2';
      }
      if (statusBar) statusBar.textContent = 'Snapshot dan data master direset.';
      await onStatusReloadRequired?.();
    } catch (error) {
      if (statusBar) statusBar.textContent = `Error: ${error}`;
    }
  });

  clearButton?.addEventListener('click', async () => {
    if (masterTextarea) masterTextarea.value = '';
    await tauriBridge.clearWorkspaceData();
    if (dashboardMasterCount) dashboardMasterCount.textContent = '0';
    onResetDependentData?.();
    if (statusBar) statusBar.textContent = 'Data di-clear.';
  });

  manualSnapshotButton?.addEventListener('click', async () => {
    try {
      const snapshotCount = await tauriBridge.createDataSnapshot();
      if (snapshotLabel) {
        snapshotLabel.textContent = `📸 Manual snapshot ${snapshotCount} baris ✅ ${new Date().toLocaleTimeString('id-ID')}`;
        snapshotLabel.className = 'text-success ml-2';
      }
      if (statusBar) statusBar.textContent = `Manual snapshot: ${snapshotCount} baris tersimpan.`;
      await onStatusReloadRequired?.();
    } catch (error) {
      if (statusBar) statusBar.textContent = `Error: ${error}`;
    }
  });

  let lastSnapshotHour = -1;
  const autoSnapshotIntervalId = setInterval(async () => {
    const now = new Date();
    const masterCountText = dashboardMasterCount?.textContent || '0';
    const masterCount = Number.parseInt(masterCountText, 10) || 0;

    if (
      shouldTriggerAutoSnapshot({
        hour: now.getHours(),
        minute: now.getMinutes(),
        lastSnapshotHour,
        masterCount,
      })
    ) {
      try {
        const snapshotCount = await tauriBridge.createDataSnapshot();
        lastSnapshotHour = now.getHours();
        if (snapshotLabel) {
          snapshotLabel.textContent = `⏰ Auto-snapshot ${snapshotCount} baris — jam ${now.toLocaleTimeString('id-ID', {
            hour: '2-digit',
            minute: '2-digit',
          })}`;
          snapshotLabel.className = 'text-info ml-2';
        }
        await onStatusReloadRequired?.();
      } catch (error) {
        console.error(error);
      }
    }
  }, 60000);

  return {
    destroy: () => clearInterval(autoSnapshotIntervalId),
    getMasterRowCount: () => Number.parseInt(dashboardMasterCount?.textContent || '0', 10) || 0,
    setDatabaseLoadedInfo: ({ count, fileName }) => {
      const previousLoad = appStore.getState('databaseLoad') || {};
      const nextCount = count !== undefined ? count : (previousLoad.rowCount ?? 0);
      const nextFileName = fileName ?? previousLoad.fileName ?? '';

      appStore.setState({
        dbFileName: nextFileName,
        databaseLoad: {
          status: nextFileName || Number(nextCount) > 0 ? 'loaded' : 'idle',
          fileName: nextFileName,
          rowCount: nextCount,
          errorMessage: '',
        },
      });
    },
  };
}

