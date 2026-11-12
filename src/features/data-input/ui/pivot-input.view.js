import { tauriBridge } from '../../../shared/adapters/tauri-bridge.js';
import { storageAdapter } from '../../../shared/adapters/storage-adapter.js';
import { appStore } from '../../../shared/state/app-store.js';
import { escapeHtml } from '../../../shared/utils/dom-helpers.js';
import {
  clearPivotDraft,
  enrichPivotRows,
  loadSavedPivotDraft,
  parsePivotData,
  savePivotDraft,
} from '../logic/pivot-parser.js';

/**
 * Manages the Pivot Data sub-tab: draft restoration, parsing/DB enrichment, table rendering, and reset.
 */
export function initPivotInputView({ onPivotUpdated = null } = {}) {
  const pivotTextarea = document.getElementById('txt-pivot');
  const pivotTableBody = document.getElementById('pivot-tbody');
  const processButton = document.getElementById('btn-process-pivot');
  const clearButton = document.getElementById('btn-clear-pivot');
  const resetButton = document.getElementById('btn-reset-pivot');
  const statusBar = document.getElementById('status-bar');

  const draft = loadSavedPivotDraft(storageAdapter);
  appStore.setState({ pivotData: draft.rows });
  if (pivotTextarea && draft.rawText) {
    pivotTextarea.value = draft.rawText;
  }

  function renderPivotTable() {
    if (!pivotTableBody) return;
    const rows = appStore.getState('pivotData') || [];

    if (rows.length === 0) {
      pivotTableBody.innerHTML =
        '<tr><td colspan="8" class="text-center text-subtle table-empty-cell">Belum ada data pivot diproses.</td></tr>';
      return;
    }

    pivotTableBody.innerHTML = rows
      .map((row) => {
        const badgeClass =
          row.monitoring === 'STOLLEN' || row.monitoring === 'CABLE STOLLEN' ? 'br' : 'ba';
        const picName =
          row.monitoring === 'STOLLEN' || row.monitoring === 'CABLE STOLLEN'
            ? row.rtsName || row.teName || row.newTe
            : row.teName || row.newTe;

        return `
          <tr>
            <td><span class="badge ${badgeClass}">${escapeHtml(row.monitoring)}</span></td>
            <td>${escapeHtml(row.system)}</td>
            <td>${escapeHtml(row.cluster)}</td>
            <td>${escapeHtml(row.newId)}</td>
            <td>${escapeHtml(row.siteName)}</td>
            <td>${escapeHtml(row.tanggal)}</td>
            <td>${escapeHtml(row.category)}</td>
            <td>${escapeHtml(picName)}</td>
          </tr>
        `;
      })
      .join('');
  }

  function resetPivotData() {
    if (pivotTextarea) pivotTextarea.value = '';
    appStore.setState({ pivotData: [] });
    clearPivotDraft(storageAdapter);
    renderPivotTable();
  }

  processButton?.addEventListener('click', async () => {
    const pastedText = (pivotTextarea?.value || '').trim();
    if (!pastedText) {
      alert('Silakan paste data pivot terlebih dahulu.');
      return;
    }

    if (statusBar) statusBar.textContent = 'Sedang memproses & mencocokkan data pivot...';

    const parsedRows = parsePivotData(pastedText);
    const enrichedRows = await enrichPivotRows(parsedRows, {
      lookupSite: (siteId) => tauriBridge.lookupSite(siteId),
      statusData: appStore.getState('statusData') || [],
    });

    appStore.setState({ pivotData: enrichedRows });
    savePivotDraft(storageAdapter, enrichedRows, pastedText);
    renderPivotTable();

    if (statusBar) statusBar.textContent = `Selesai! Memproses ${enrichedRows.length} baris pivot.`;
    await onPivotUpdated?.();
  });

  clearButton?.addEventListener('click', () => {
    if (pivotTextarea) pivotTextarea.value = '';
  });

  resetButton?.addEventListener('click', async () => {
    resetPivotData();
    await onPivotUpdated?.();
  });

  renderPivotTable();

  return {
    renderPivotTable,
    resetPivotData,
  };
}

