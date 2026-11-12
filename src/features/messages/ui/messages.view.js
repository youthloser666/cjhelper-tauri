import { clipboardAdapter } from '../../../shared/adapters/clipboard-adapter.js';
import { storageAdapter } from '../../../shared/adapters/storage-adapter.js';
import { appStore } from '../../../shared/state/app-store.js';
import { escapeHtml } from '../../../shared/utils/dom-helpers.js';
import { flashTemporaryFeedback } from '../../../shared/utils/feedback.js';
import { bindSegmentedControl } from '../../../shared/ui/segmented-control.js';
import { loadFormatConfig } from '../logic/format-config.js';
import { buildPmGroups, generatePmGroupText } from '../logic/pm-grouping.js';

/**
 * Manages Messages (PM) collapsible group rendering, selection/Shift+click,
 * live preview, clipboard copy, and links to Blast modals.
 */
export function initMessagesView({
  onOpenWaBlast = null,
  onOpenBlastFilter = null,
} = {}) {
  const pmTableBody = document.getElementById('pm-tbody');
  const pmPreview = document.getElementById('pm-preview-text');
  const pmTotalLabel = document.getElementById('pm-total-lbl');
  const modeSegmented = document.getElementById('pm-mode-seg');

  let pmGroups = [];
  let pmMode = 'cluster';
  let pmShowRemark = true;
  let pmClarityFilter = 'all';
  let pmLastSelectedIndex = -1;
  const collapsedGroupKeys = new Set();

  const smartFilterGroup = document.getElementById('pm-smart-filter');

  function syncSmartFilterPills() {
    smartFilterGroup?.querySelectorAll('.smart-pill').forEach((btn) => {
      const isMatch = (btn.dataset.clarity || 'all') === pmClarityFilter;
      btn.classList.toggle('active', isMatch);
      btn.setAttribute('aria-pressed', String(isMatch));
    });
  }

  function getActiveFmtMsg() {
    return appStore.getState('fmtMsg') || loadFormatConfig(storageAdapter, 'msg');
  }

  function getActiveFmtBc() {
    return appStore.getState('fmtBc') || loadFormatConfig(storageAdapter, 'bc');
  }

  function renderPM() {
    if (!pmTableBody) return;

    const fmtMsg = getActiveFmtMsg();
    pmGroups = buildPmGroups({
      statusData: appStore.getState('statusData') || [],
      netdroneData: appStore.getState('netdroneData') || [],
      regionFilter: appStore.getState('activeRegionFilter') || 'ALL',
      pmMode,
      filters: {
        cluster: document.getElementById('pm-f-cl')?.value || '',
        newSite: document.getElementById('pm-f-ns')?.value || '',
        remark: document.getElementById('pm-f-rem')?.value || '',
        clarity: pmClarityFilter,
      },
      fmtMsg,
      showRemark: pmShowRemark,
    });

    appStore.setState({ pmDataGroups: pmGroups });

    if (pmTotalLabel) {
      pmTotalLabel.textContent = `Total: ${pmGroups.length} ${pmMode === 'cluster' ? 'CLUSTER' : 'RTS'}`;
    }

    pmTableBody.innerHTML = '';
    pmLastSelectedIndex = -1;

    pmGroups.forEach((group, groupIndex) => {
      const isCollapsed = collapsedGroupKeys.has(group.key);
      const headerRow = document.createElement('tr');
      headerRow.className = 'group-header';
      headerRow.dataset.gkey = group.key;
      headerRow.dataset.gidx = groupIndex;
      headerRow.dataset.groupMsg = 'true';

      const arrowCell = document.createElement('td');
      arrowCell.className = 'pm-arrow-cell';
      arrowCell.textContent = isCollapsed ? '▶' : '▼';
      arrowCell.title = isCollapsed ? 'Expand' : 'Collapse';

      arrowCell.addEventListener('click', (event) => {
        event.stopPropagation();
        if (isCollapsed) collapsedGroupKeys.delete(group.key);
        else collapsedGroupKeys.add(group.key);
        renderPM();
      });

      const headerCell = document.createElement('td');
      headerCell.colSpan = 7;
      headerCell.className = 'pm-header-cell';
      headerCell.textContent = `GROUP  ${group.header}  (${group.allEntries.length} sites)`;

      headerRow.appendChild(arrowCell);
      headerRow.appendChild(headerCell);

      headerRow.addEventListener('click', (event) => {
        if (event.target === arrowCell) return;
        event.stopPropagation();

        const dataRows = Array.from(pmTableBody.querySelectorAll('tr:not(.group-header)'));
        if (!event.ctrlKey && !event.metaKey && !event.shiftKey) {
          dataRows.forEach((row) => row.classList.remove('selected'));
          pmTableBody.querySelectorAll('.group-header').forEach((header) => header.classList.remove('selected'));
        }

        headerRow.classList.toggle('selected');
        if (pmPreview) {
          pmPreview.value = generatePmGroupText(group, { formatConfig: fmtMsg, pmMode });
        }
      });

      pmTableBody.appendChild(headerRow);

      if (!isCollapsed) {
        group.allEntries.forEach((item) => {
          const itemRow = document.createElement('tr');
          itemRow.className = 'pm-data-row';
          itemRow.dataset.waLine = item.waLine;
          itemRow.dataset.gidx = groupIndex;

          const badgeClass = item.isFully ? 'br' : item.isBcch ? 'ba' : 'bb';
          const clarityBadgeHtml =
            item.remarkClarity === 'empty'
              ? '<span class="remark-flag remark-flag--empty">No Remark</span>'
              : item.remarkClarity === 'unclear'
                ? '<span class="remark-flag remark-flag--unclear">Needs Follow-Up</span>'
                : '';
          itemRow.innerHTML = `
            <td><span class="badge ${badgeClass}">${escapeHtml(item.typeIcon)}</span></td>
            <td>${escapeHtml(item.cluster)}</td>
            <td>${escapeHtml(item.pic || '')}</td>
            <td>${escapeHtml(item.site_name)}</td>
            <td>${escapeHtml(item.old_site || '')}</td>
            <td>${escapeHtml(item.new_site)}</td>
            <td>${escapeHtml(item.time)}</td>
            <td class="pm-remark-cell">${clarityBadgeHtml}${escapeHtml(item.remark)}</td>
          `;

          itemRow.addEventListener('click', (event) => {
            event.stopPropagation();
            const dataRows = Array.from(pmTableBody.querySelectorAll('tr:not(.group-header)'));
            const currentIndex = dataRows.indexOf(itemRow);

            if (event.shiftKey && pmLastSelectedIndex !== -1) {
              const rangeStart = Math.min(pmLastSelectedIndex, currentIndex);
              const rangeEnd = Math.max(pmLastSelectedIndex, currentIndex);
              dataRows.forEach((row, index) => {
                if (index >= rangeStart && index <= rangeEnd) {
                  row.classList.add('selected');
                }
              });
              document.getSelection?.()?.removeAllRanges();
            } else if (event.ctrlKey || event.metaKey) {
              itemRow.classList.toggle('selected');
              pmLastSelectedIndex = currentIndex;
            } else {
              dataRows.forEach((row) => row.classList.remove('selected'));
              pmTableBody.querySelectorAll('.group-header').forEach((header) => header.classList.remove('selected'));
              itemRow.classList.add('selected');
              pmLastSelectedIndex = currentIndex;
            }

            if (pmPreview) {
              pmPreview.value = item.waLine;
            }
          });

          pmTableBody.appendChild(itemRow);
        });
      }
    });
  }

  function getSelectedPMLines() {
    if (!pmTableBody) return [];
    const fmtMsg = getActiveFmtMsg();
    const selectedRows = Array.from(pmTableBody.querySelectorAll('tr.selected'));
    const lines = [];

    selectedRows.forEach((row) => {
      if (row.classList.contains('group-header')) {
        const groupIndex = Number.parseInt(row.dataset.gidx, 10);
        if (pmGroups[groupIndex]) {
          lines.push(generatePmGroupText(pmGroups[groupIndex], { formatConfig: fmtMsg, pmMode }));
        }
      } else if (row.dataset.waLine) {
        lines.push(row.dataset.waLine);
      }
    });

    return lines;
  }

  function flashPmCopyStatus(message) {
    flashTemporaryFeedback(pmTotalLabel, message, { durationMs: 2000 });
  }

  bindSegmentedControl(modeSegmented, (nextMode) => {
    pmMode = nextMode || 'cluster';
    collapsedGroupKeys.clear();
    renderPM();
  });

  smartFilterGroup?.addEventListener('click', (event) => {
    const button = event.target.closest('.smart-pill');
    if (!button) return;
    pmClarityFilter = button.dataset.clarity || 'all';
    syncSmartFilterPills();
    renderPM();
  });

  ['pm-f-cl', 'pm-f-ns', 'pm-f-rem'].forEach((inputId) => {
    document.getElementById(inputId)?.addEventListener('input', renderPM);
  });

  document.getElementById('btn-pm-reset')?.addEventListener('click', () => {
    ['pm-f-cl', 'pm-f-ns', 'pm-f-rem'].forEach((inputId) => {
      const element = document.getElementById(inputId);
      if (element) element.value = '';
    });
    pmClarityFilter = 'all';
    syncSmartFilterPills();
    renderPM();
  });

  document.getElementById('btn-pm-collapse')?.addEventListener('click', () => {
    pmGroups.forEach((group) => collapsedGroupKeys.add(group.key));
    renderPM();
  });

  document.getElementById('btn-pm-expand')?.addEventListener('click', () => {
    collapsedGroupKeys.clear();
    renderPM();
  });

  const remarkButton = document.getElementById('btn-pm-remark');
  remarkButton?.addEventListener('click', () => {
    pmShowRemark = !pmShowRemark;
    remarkButton.textContent = `Remark: ${pmShowRemark ? 'ON' : 'OFF'}`;
    remarkButton.classList.toggle('pm-remark-off', !pmShowRemark);
    renderPM();
  });

  document.addEventListener('keydown', async (event) => {
    if (appStore.getState('activeTab') !== 'tab-pm') return;
    if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 'c') return;

    const activeElement = document.activeElement;
    if (
      activeElement &&
      (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA')
    ) {
      return;
    }

    const lines = getSelectedPMLines();
    if (lines.length > 0) {
      event.preventDefault();
      const text = lines.some((line) => line.includes('\n')) ? lines.join('\n\n') : lines.join('\n');
      await clipboardAdapter.writeText(text);
      flashPmCopyStatus(`Copied ${lines.length} item!`);
    }
  });

  document.getElementById('btn-pm-copy-sel')?.addEventListener('click', async () => {
    const lines = getSelectedPMLines();
    if (lines.length === 0) {
      alert('Pilih baris dulu.');
      return;
    }
    const text = lines.some((line) => line.includes('\n')) ? lines.join('\n\n') : lines.join('\n');
    await clipboardAdapter.writeText(text);
    flashPmCopyStatus(`Copied ${lines.length} item!`);
  });

  document.getElementById('btn-pm-copy-all')?.addEventListener('click', async () => {
    if (pmGroups.length === 0) return;
    const fmtMsg = getActiveFmtMsg();
    const combined = pmGroups
      .map((group) => generatePmGroupText(group, { formatConfig: fmtMsg, pmMode }))
      .join('\n\n');
    await clipboardAdapter.writeText(combined);
    flashPmCopyStatus(`Copied ${pmGroups.length} groups!`);
  });

  document.getElementById('btn-pm-wa-blast')?.addEventListener('click', () => {
    onOpenWaBlast?.({
      groups: pmGroups,
      fmtBc: getActiveFmtBc(),
      pmMode,
    });
  });

  document.getElementById('btn-pm-blast-filter')?.addEventListener('click', () => {
    onOpenBlastFilter?.();
  });

  appStore.subscribe('statusData', renderPM);
  appStore.subscribe('netdroneData', renderPM);
  appStore.subscribe('activeRegionFilter', renderPM);
  appStore.on('formatting:saved', renderPM);

  renderPM();

  return { renderPM, getGroups: () => pmGroups };
}

