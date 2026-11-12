import { tauriBridge } from '../../../shared/adapters/tauri-bridge.js';
import { storageAdapter } from '../../../shared/adapters/storage-adapter.js';
import { appStore } from '../../../shared/state/app-store.js';
import { escapeHtml } from '../../../shared/utils/dom-helpers.js';
import {
  clearNetdroneDraft,
  loadSavedNetdroneDraft,
  parseAndEnrichNetdroneData,
  saveNetdroneDraft,
} from '../logic/netdrone-parser.js';

/**
 * Manages the Netdrone Data sub-tab: draft restoration, input state feedback, DB enrichment, and reset.
 */
export function initNetdroneInputView({ onNetdroneUpdated = null } = {}) {
  const netdroneTextarea = document.getElementById('txt-netdrone');
  const netdroneTableBody = document.getElementById('netdrone-tbody');
  const summaryLabel = document.getElementById('lbl-netdrone-summary');
  const processButton = document.getElementById('btn-process-netdrone');
  const clearButton = document.getElementById('btn-clear-netdrone');

  const draft = loadSavedNetdroneDraft(storageAdapter);
  appStore.setState({ netdroneData: draft.rows });
  if (netdroneTextarea && draft.rawText) {
    netdroneTextarea.value = draft.rawText;
  }

  function renderNetdroneTable() {
    if (!netdroneTableBody) return;
    const rows = appStore.getState('netdroneData') || [];

    if (rows.length === 0) {
      netdroneTableBody.innerHTML =
        '<tr><td colspan="8" class="text-center text-subtle table-empty-cell">Belum ada data Netdrone diproses.</td></tr>';
      if (summaryLabel) summaryLabel.textContent = '0 data diproses';
      return;
    }

    const matchedCount = rows.filter((row) => !row.skipped && row.matchedDb).length;
    const skippedCount = rows.filter((row) => row.skipped).length;
    const notFoundCount = rows.filter((row) => !row.skipped && !row.matchedDb).length;

    if (summaryLabel) {
      summaryLabel.textContent = `${matchedCount} Matched DB | ${skippedCount} Skipped (Master) | ${notFoundCount} DB Tidak Ditemukan`;
    }

    const fragment = document.createDocumentFragment();
    rows.forEach((row, index) => {
      const tableRow = document.createElement('tr');
      let badgeClass = 'bb';
      if (row.skipped) badgeClass = 'ba';
      else if (row.matchedDb) badgeClass = 'br';

      tableRow.innerHTML = `
        <td>${index + 1}</td>
        <td><strong>${escapeHtml(row.siteId)}</strong></td>
        <td>${escapeHtml(row.siteName)}</td>
        <td>${escapeHtml(row.vendor || '-')}</td>
        <td>${escapeHtml(row.alarmName || '-')}</td>
        <td>${escapeHtml(row.cluster || '-')}</td>
        <td>${escapeHtml(row.pic || '-')}</td>
        <td><span class="badge ${badgeClass}">${escapeHtml(row.statusMessage)}</span></td>
      `;
      fragment.appendChild(tableRow);
    });

    netdroneTableBody.innerHTML = '';
    netdroneTableBody.appendChild(fragment);
  }

  function syncProcessButtonState() {
    if (!netdroneTextarea || !processButton) return;
    const rawValue = netdroneTextarea.value.trim();
    if (rawValue) {
      const lineCount = rawValue.split('\n').filter((line) => line.trim()).length;
      processButton.disabled = false;
      processButton.textContent = `▶ PROSES NETDRONE (${lineCount} baris)`;
    } else {
      processButton.disabled = true;
      processButton.textContent = '▶ PROSES NETDRONE (Kosong)';
    }
  }

  function resetNetdroneData() {
    if (netdroneTextarea) netdroneTextarea.value = '';
    appStore.setState({ netdroneData: [] });
    clearNetdroneDraft(storageAdapter);
    syncProcessButtonState();
    renderNetdroneTable();
  }

  netdroneTextarea?.addEventListener('input', syncProcessButtonState);

  processButton?.addEventListener('click', async () => {
    const pastedText = (netdroneTextarea?.value || '').trim();
    if (!pastedText) return;

    processButton.disabled = true;
    processButton.textContent = '⏳ Memproses & mencocokkan DB...';

    try {
      const enrichedRows = await parseAndEnrichNetdroneData(pastedText, {
        statusData: appStore.getState('statusData') || [],
        lookupSite: (siteId) => tauriBridge.lookupSite(siteId),
      });

      appStore.setState({ netdroneData: enrichedRows });
      saveNetdroneDraft(storageAdapter, enrichedRows, pastedText);
      renderNetdroneTable();
      onNetdroneUpdated?.();
    } catch (error) {
      console.error('Error memproses Data Netdrone:', error);
    } finally {
      syncProcessButtonState();
    }
  });

  clearButton?.addEventListener('click', () => {
    resetNetdroneData();
    onNetdroneUpdated?.();
  });

  syncProcessButtonState();
  renderNetdroneTable();

  return {
    renderNetdroneTable,
    resetNetdroneData,
  };
}

