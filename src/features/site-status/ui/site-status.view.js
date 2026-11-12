import { clipboardAdapter } from '../../../shared/adapters/clipboard-adapter.js';
import { appStore } from '../../../shared/state/app-store.js';
import { escapeHtml } from '../../../shared/utils/dom-helpers.js';
import { flashTemporaryFeedback } from '../../../shared/utils/feedback.js';
import { bindSegmentedControl, setSegmentedControlValue } from '../../../shared/ui/segmented-control.js';
import { bindTableSelection } from '../../../shared/ui/table-selection.js';
import {
  computeStatusCounts,
  filterAndSortSiteStatuses,
  resolveStatusBadges,
} from '../logic/status-filter.js';
import {
  formatSiteStatusBatchCopy,
  formatSiteStatusClipboardLine,
} from '../logic/share-whatsapp-formatter.js';

const DEFAULT_COPY_HINT = 'Shift+klik range | Ctrl+klik multi | Ctrl+C copy';

/**
 * Manages the Site Status table filtering, sorting, row selection, and clipboard copy actions.
 */
export function initSiteStatusView() {
  const statusTableBody = document.getElementById('status-tbody');
  const statusFilterContainer = document.getElementById('st-filter-status');
  const sortFilterContainer = document.getElementById('st-filter-sort');
  const searchInput = document.getElementById('st-search');
  const resetButton = document.getElementById('st-search-reset');
  const copyInfoLabel = document.getElementById('st-copy-info');

  function getActiveControlValue(containerSelector, fallbackValue) {
    return document.querySelector(`${containerSelector} .active`)?.dataset?.val || fallbackValue;
  }

  function showCopyInfoFlash(message) {
    flashTemporaryFeedback(copyInfoLabel, message, {
      durationMs: 2000,
      restoreText: DEFAULT_COPY_HINT,
    });
  }

  const tableSelection = bindTableSelection(statusTableBody, {
    isCopyShortcutActive: () => appStore.getState('activeTab') === 'tab-status',
    onCopySelected: async (selectedRows) => {
      const text = selectedRows.map((row) => row.dataset.copyStr).filter(Boolean).join('\n');
      if (!text) return;
      await clipboardAdapter.writeText(text);
      showCopyInfoFlash(`Copied ${selectedRows.length} item!`);
    },
  });

  function renderStatusTable() {
    if (!statusTableBody) return;

    const statusData = appStore.getState('statusData') || [];
    const regionFilter = appStore.getState('activeRegionFilter') || 'ALL';
    const statusFilter = getActiveControlValue('#st-filter-status', 'ALL');
    const sortOrder = getActiveControlValue('#st-filter-sort', 'none');
    const searchQuery = searchInput?.value || '';

    const counts = computeStatusCounts(statusData, regionFilter);
    const upLabel = document.getElementById('lbl-up-count');
    const downLabel = document.getElementById('lbl-down-count');
    if (upLabel) upLabel.textContent = counts.upCount;
    if (downLabel) downLabel.textContent = counts.downCount;

    const filteredRows = filterAndSortSiteStatuses(statusData, {
      regionFilter,
      statusFilter,
      searchQuery,
      sortOrder,
    });

    tableSelection.resetAnchor();
    const fragment = document.createDocumentFragment();

    filteredRows.forEach((site, index) => {
      const tableRow = document.createElement('tr');
      tableRow.className = (site.status || '').toLowerCase();
      tableRow.dataset.index = index;
      tableRow.dataset.copyStr = formatSiteStatusClipboardLine(site);

      const { impactClass, agingClass } = resolveStatusBadges(site);

      tableRow.innerHTML = `
        <td>${escapeHtml(site.icon)}</td>
        <td>${escapeHtml(site.new_site)}</td>
        <td>${escapeHtml(site.site_name)}</td>
        <td>${escapeHtml(site.cluster)}</td>
        <td><span class="badge ${impactClass}">${escapeHtml(site.impact)}</span></td>
        <td>${escapeHtml(site.rts)}</td>
        <td>${escapeHtml(site.start_time)}</td>
        <td><span class="badge ${agingClass}">${escapeHtml(site.agging)}</span></td>
        <td>${escapeHtml(site.remark)}</td>
      `;
      fragment.appendChild(tableRow);
    });

    statusTableBody.innerHTML = '';
    statusTableBody.appendChild(fragment);
  }

  bindSegmentedControl(statusFilterContainer, renderStatusTable);
  bindSegmentedControl(sortFilterContainer, renderStatusTable);
  searchInput?.addEventListener('input', renderStatusTable);

  resetButton?.addEventListener('click', () => {
    if (searchInput) searchInput.value = '';
    setSegmentedControlValue(statusFilterContainer, 'ALL');
    setSegmentedControlValue(sortFilterContainer, 'none');
    renderStatusTable();
  });

  document.getElementById('btn-st-copy-sel')?.addEventListener('click', async () => {
    const selectedRows = tableSelection.getSelectedRows();
    if (selectedRows.length === 0) {
      alert('Pilih baris dulu.');
      return;
    }
    const text = selectedRows.map((row) => row.dataset.copyStr).filter(Boolean).join('\n');
    await clipboardAdapter.writeText(text);
    showCopyInfoFlash(`Copied ${selectedRows.length} item!`);
  });

  document.getElementById('btn-st-copy-down')?.addEventListener('click', async () => {
    const statusData = appStore.getState('statusData') || [];
    const text = formatSiteStatusBatchCopy(statusData, 'DOWN');
    if (!text) return;
    await clipboardAdapter.writeText(text);
    showCopyInfoFlash(`Copied ${text.split('\n').length}!`);
  });

  document.getElementById('btn-st-copy-up')?.addEventListener('click', async () => {
    const statusData = appStore.getState('statusData') || [];
    const text = formatSiteStatusBatchCopy(statusData, 'UP');
    if (!text) return;
    await clipboardAdapter.writeText(text);
    showCopyInfoFlash(`Copied ${text.split('\n').length}!`);
  });

  document.getElementById('btn-st-copy-all')?.addEventListener('click', async () => {
    const statusData = appStore.getState('statusData') || [];
    const text = formatSiteStatusBatchCopy(statusData, 'ALL');
    if (!text) return;
    await clipboardAdapter.writeText(text);
    alert(`Copied ${statusData.length} baris.`);
  });

  appStore.subscribe('statusData', renderStatusTable);
  appStore.subscribe('activeRegionFilter', renderStatusTable);

  renderStatusTable();

  return { renderStatusTable };
}

