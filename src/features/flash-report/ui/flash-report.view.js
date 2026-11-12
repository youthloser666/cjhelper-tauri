import { tauriBridge } from '../../../shared/adapters/tauri-bridge.js';
import { clipboardAdapter } from '../../../shared/adapters/clipboard-adapter.js';
import { appStore } from '../../../shared/state/app-store.js';
import { escapeHtml } from '../../../shared/utils/dom-helpers.js';
import { flashTemporaryFeedback } from '../../../shared/utils/feedback.js';
import {
  enrichFlashMasterRows,
  mapStatusRowsToFlashMasterRows,
  parseFlashMasterTSV,
} from '../logic/flash-master-parser.js';
import { computeFlashStats, filterFlashRows } from '../logic/flash-filter.js';
import {
  buildFlashReportText,
  computeDefaultFlashReportTime,
} from '../logic/flash-report-builder.js';

/**
 * Coordinates Flash Report parsing, DB enrichment, manual Position PG entries, and WhatsApp formatting.
 */
export function initFlashReportView() {
  let activeRegion = 'ALL';
  let activeImpact = 'FULLY';
  let manualPgList = [];

  const subtabButtons = Array.from(document.querySelectorAll('#flash-subtab-seg .seg-btn'));
  const subtabPanes = Array.from(document.querySelectorAll('.fr-subtab-pane'));
  const regionButtons = Array.from(document.querySelectorAll('.fr-reg-btn'));
  const impactButtons = Array.from(document.querySelectorAll('.fr-imp-btn'));

  function getFilteredRows() {
    return filterFlashRows(appStore.getState('flashMasterData') || [], {
      region: activeRegion,
      impact: activeImpact,
    });
  }

  function renderMasterTable() {
    const tbody = document.getElementById('fr-master-tbody');
    const countLabel = document.getElementById('fr-tbl-count');
    if (!tbody) return;

    const filteredRows = getFilteredRows();
    if (countLabel) countLabel.textContent = `${filteredRows.length} sites`;

    if (filteredRows.length === 0) {
      tbody.innerHTML =
        '<tr><td colspan="9" class="text-center text-subtle fr-empty-cell">Belum ada data master diproses untuk wilayah ini.</td></tr>';
      return;
    }

    tbody.innerHTML = '';
    const fragment = document.createDocumentFragment();

    filteredRows.forEach((row, index) => {
      const tableRow = document.createElement('tr');
      if (row.matchesFilter) {
        tableRow.classList.add('fr-row-match');
      }

      const matchBadge = row.matchesFilter
        ? '<span class="fr-match-badge">MATCH</span>'
        : '<span class="fr-empty-dash">-</span>';

      const netToneClass = row.is2G ? 'fr-net-2g' : 'fr-net-4g';
      const remarkClass = row.matchesFilter ? 'fr-remark-active' : 'fr-remark-muted';

      tableRow.innerHTML = `
        <td class="fr-cell-muted">${index + 1}</td>
        <td><span class="badge fr-badge-sm">${escapeHtml(row.region)}</span></td>
        <td class="fr-cell-strong">${escapeHtml(row.mcCluster || '-')}</td>
        <td class="fr-cell-mono">${escapeHtml(row.siteId)}</td>
        <td class="fr-cell-text">${escapeHtml(row.siteName)}</td>
        <td><span class="${netToneClass}">${escapeHtml(row.netLabel)}</span></td>
        <td class="fr-cell-secondary">${escapeHtml(row.impact || '-')}</td>
        <td class="${remarkClass}">${escapeHtml(row.remark || '-')}</td>
        <td class="text-center">${matchBadge}</td>
      `;
      fragment.appendChild(tableRow);
    });

    tbody.appendChild(fragment);
  }

  function updateStats() {
    const filteredRows = getFilteredRows();
    const stats = computeFlashStats(filteredRows, manualPgList);

    const setStat = (id, value) => {
      const element = document.getElementById(id);
      if (element) element.textContent = value;
    };

    setStat('fr-stat-total', stats.totalRows);
    setStat('fr-stat-mc', stats.mcCount);
    setStat('fr-stat-2g', stats.siteDown2g);
    setStat('fr-stat-4g', stats.siteDown4g);
    setStat('fr-stat-matched', stats.matchedTotal);

    const headerSummary = document.getElementById('fr-header-summary');
    if (headerSummary) {
      headerSummary.textContent = `${stats.mcCount} MC Impact • 2G: ${stats.siteDown2g} | 4G: ${stats.siteDown4g}`;
    }

    const input2g = document.getElementById('fr-input-2g');
    const input4g = document.getElementById('fr-input-4g');
    if (input2g && input4g) {
      input2g.value = stats.siteDown2g;
      input4g.value = stats.siteDown4g;
    }
  }

  function renderReportPreview() {
    const previewBox = document.getElementById('fr-preview-box');
    const charCountLabel = document.getElementById('fr-preview-char-count');
    if (!previewBox) return;

    const filteredRows = getFilteredRows();
    const reportText = buildFlashReportText({
      filteredRows,
      manualEntries: manualPgList,
      timeStr: (document.getElementById('fr-time-input')?.value || '21:00').trim(),
      titleRegion: (document.getElementById('fr-title-input')?.value || 'Central Java').trim(),
      mcFormat: document.getElementById('fr-mc-format')?.value || 'comma',
      count2g: document.getElementById('fr-input-2g')?.value ?? filteredRows.length,
      count4g: document.getElementById('fr-input-4g')?.value ?? filteredRows.length,
      dgRunning: document.getElementById('fr-dg-running')?.value || 0,
      dgTotal: document.getElementById('fr-dg-total')?.value || 0,
      teamMove: (document.getElementById('fr-team-move')?.value || '').trim(),
      pgCompleted: document.getElementById('fr-pg-completed')?.value,
      pgInstalled: document.getElementById('fr-pg-installed')?.value,
      pgMovement: document.getElementById('fr-pg-movement')?.value,
    });

    previewBox.value = reportText;
    if (charCountLabel) {
      const lineCount = reportText ? reportText.split('\n').length : 0;
      charCountLabel.textContent = `${reportText.length} characters | ${lineCount} lines`;
    }
  }

  function renderManualTable() {
    const tbody = document.getElementById('fr-manual-tbody');
    if (!tbody) return;

    tbody.innerHTML = '';
    if (manualPgList.length === 0) {
      tbody.innerHTML =
        '<tr><td colspan="7" class="text-center text-subtle fr-empty-sm">Belum ada data manual ditambahkan.</td></tr>';
      return;
    }

    manualPgList.forEach((entry, index) => {
      const tableRow = document.createElement('tr');
      tableRow.innerHTML = `
        <td class="fr-cell-muted">${index + 1}</td>
        <td><span class="badge fr-badge-xs">${escapeHtml(entry.region)}</span></td>
        <td class="fr-cell-bold">${escapeHtml(entry.cluster)}</td>
        <td class="fr-cell-mono-text">${escapeHtml(entry.siteId)}</td>
        <td>${escapeHtml(entry.siteName)}</td>
        <td class="fr-cell-text-sm">${escapeHtml(entry.remark)}</td>
        <td class="text-center">
          <button class="tbtn-clr btn-fr-del-manual btn-danger-xs" data-idx="${index}">Hapus</button>
        </td>
      `;
      tbody.appendChild(tableRow);
    });
  }

  // Delegated manual PG deletion click
  document.getElementById('fr-manual-tbody')?.addEventListener('click', (event) => {
    const deleteButton = event.target.closest('.btn-fr-del-manual');
    if (!deleteButton) return;
    const index = Number.parseInt(deleteButton.dataset.idx, 10);
    if (Number.isNaN(index)) return;
    manualPgList.splice(index, 1);
    renderManualTable();
    updateStats();
    renderReportPreview();
  });

  subtabButtons.forEach((button) => {
    button.addEventListener('click', () => {
      subtabButtons.forEach((item) => item.classList.remove('active'));
      subtabPanes.forEach((pane) => pane.classList.add('hidden'));

      button.classList.add('active');
      const targetId = button.dataset.subtarget;
      const targetPane = targetId ? document.getElementById(targetId) : null;
      if (targetPane) targetPane.classList.remove('hidden');

      if (targetId === 'subtab-fr-output') {
        renderReportPreview();
      }
    });
  });

  regionButtons.forEach((button) => {
    button.addEventListener('click', () => {
      regionButtons.forEach((item) => item.classList.remove('active'));
      button.classList.add('active');
      activeRegion = button.dataset.reg || 'ALL';

      const titleInput = document.getElementById('fr-title-input');
      if (titleInput) {
        if (activeRegion === 'CJN') titleInput.value = 'Central Java North';
        else if (activeRegion === 'CJS') titleInput.value = 'Central Java South';
        else titleInput.value = 'Central Java';
      }

      renderMasterTable();
      updateStats();
      renderReportPreview();
    });
  });

  impactButtons.forEach((button) => {
    button.addEventListener('click', () => {
      impactButtons.forEach((item) => item.classList.remove('active'));
      button.classList.add('active');
      activeImpact = button.dataset.imp || 'FULLY';

      renderMasterTable();
      updateStats();
      renderReportPreview();
    });
  });

  function setStatusTone(statusElement, text, toneClass) {
    if (!statusElement) return;
    statusElement.textContent = text;
    statusElement.classList.remove('text-grn', 'text-accent', 'text-muted-3');
    if (toneClass) statusElement.classList.add(toneClass);
  }

  document.getElementById('btn-fr-process')?.addEventListener('click', async () => {
    const pastedText = (document.getElementById('fr-txt-master')?.value || '').trim();
    if (!pastedText) {
      alert('Silakan paste data TSV Master Table terlebih dahulu!');
      return;
    }

    const parsedRows = parseFlashMasterTSV(pastedText);
    appStore.setState({ flashMasterData: parsedRows });

    const fullyCount = parsedRows.filter((row) => row.isFully).length;
    const cellCount = parsedRows.length - fullyCount;
    setStatusTone(
      document.getElementById('fr-master-status'),
      `✅ Berhasil memproses ${parsedRows.length} baris (${fullyCount} Fully Down, ${cellCount} Cell Down).`,
      'text-grn'
    );

    renderMasterTable();
    updateStats();
    renderReportPreview();

    const updated = await enrichFlashMasterRows(parsedRows, (siteId) => tauriBridge.lookupSite(siteId));
    if (updated) {
      appStore.setState({ flashMasterData: [...parsedRows] });
      renderReportPreview();
    }
  });

  document.getElementById('btn-fr-load-main')?.addEventListener('click', async () => {
    const mainMasterText = (document.getElementById('txt-master')?.value || '').trim();
    const statusData = appStore.getState('statusData') || [];
    let nextRows = [];

    if (mainMasterText) {
      const flashTextarea = document.getElementById('fr-txt-master');
      if (flashTextarea) flashTextarea.value = mainMasterText;
      nextRows = parseFlashMasterTSV(mainMasterText);
    } else if (statusData.length > 0) {
      nextRows = mapStatusRowsToFlashMasterRows(statusData);
    } else {
      alert('Belum ada data di Master Data utama. Silakan paste data di tab Data atau paste langsung di sini.');
      return;
    }

    appStore.setState({ flashMasterData: nextRows });

    const fullyCount = nextRows.filter((row) => row.isFully).length;
    const cellCount = nextRows.length - fullyCount;
    setStatusTone(
      document.getElementById('fr-master-status'),
      `✅ Dimuat ${nextRows.length} baris (${fullyCount} Fully Down, ${cellCount} Cell Down) dari Master Data.`,
      'text-accent'
    );

    renderMasterTable();
    updateStats();
    renderReportPreview();

    const updated = await enrichFlashMasterRows(nextRows, (siteId) => tauriBridge.lookupSite(siteId));
    if (updated) {
      appStore.setState({ flashMasterData: [...nextRows] });
      renderReportPreview();
    }
  });

  document.getElementById('btn-fr-clear')?.addEventListener('click', () => {
    const textarea = document.getElementById('fr-txt-master');
    if (textarea) textarea.value = '';
    appStore.setState({ flashMasterData: [] });
    setStatusTone(document.getElementById('fr-master-status'), 'Data dikosongkan.', 'text-muted-3');
    renderMasterTable();
    updateStats();
    renderReportPreview();
  });

  const addManualButton = document.getElementById('btn-fr-add-manual');
  addManualButton?.addEventListener('click', async () => {
    const siteIdInput = document.getElementById('fr-manual-site-id');
    const remarkInput = document.getElementById('fr-manual-remark');
    const siteId = (siteIdInput?.value || '').trim();
    const remark = (remarkInput?.value || '').trim();

    if (!siteId) {
      alert('Site ID wajib diisi!');
      return;
    }

    let siteName = '';
    let cluster = '';
    let fmOffice = '';
    let hubType = 'SMALL HUB SITE';
    let region = 'CJS';

    try {
      const dbRow = await tauriBridge.lookupSite(siteId);
      if (dbRow) {
        siteName = dbRow['Site Name'] || dbRow.site_name || '';
        cluster = dbRow['FM Office'] || dbRow['Cluster (MC)'] || dbRow.cluster || '';
        fmOffice = dbRow['FM Office'] || cluster;
        hubType = dbRow['Hub Type'] || dbRow['Site Class'] || 'SMALL HUB SITE';
        const areaText = (dbRow['Area'] || dbRow['Region'] || '').toUpperCase();
        if (areaText.includes('CJN') || areaText.includes('NORTH')) region = 'CJN';
        else if (areaText.includes('CJS') || areaText.includes('SOUTH')) region = 'CJS';
      }
    } catch (error) {
      console.warn('lookup_site error for manual site:', error);
    }

    if (!siteName) {
      const masterMatch = (appStore.getState('flashMasterData') || []).find(
        (row) => (row.siteId || '').toUpperCase() === siteId.toUpperCase()
      );
      if (masterMatch) {
        siteName = masterMatch.siteName || '';
        cluster = masterMatch.cluster || masterMatch.mcCluster || cluster;
        fmOffice = masterMatch.fmOffice || cluster;
        hubType = masterMatch.hubType || hubType;
        region = masterMatch.region || region;
      }
    }

    if (!siteName) {
      const statusMatch = (appStore.getState('statusData') || []).find(
        (row) => (row.new_site || row.site_id || '').toUpperCase() === siteId.toUpperCase()
      );
      if (statusMatch) {
        siteName = statusMatch.site_name || '';
        cluster = statusMatch.cluster || cluster;
        fmOffice = cluster;
        hubType = statusMatch.category || hubType;
        const statusRegion = (statusMatch.region || statusMatch.area || '').toUpperCase();
        if (statusRegion.includes('CJN') || statusRegion.includes('NORTH')) region = 'CJN';
        else if (statusRegion.includes('CJS') || statusRegion.includes('SOUTH')) region = 'CJS';
      }
    }

    manualPgList.push({
      region,
      cluster: cluster || '01CLUSTER',
      fmOffice: fmOffice || cluster || '01CLUSTER',
      hubType,
      siteId,
      siteName: siteName || siteId,
      remark: remark || '-',
    });

    if (siteIdInput) siteIdInput.value = '';
    if (remarkInput) remarkInput.value = '';

    renderManualTable();
    updateStats();
    renderReportPreview();
  });

  ['fr-manual-site-id', 'fr-manual-remark'].forEach((inputId) => {
    document.getElementById(inputId)?.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        addManualButton?.click();
      }
    });
  });

  document.getElementById('btn-fr-sync-sitedown')?.addEventListener('click', () => {
    updateStats();
    renderReportPreview();
  });

  ['fr-dg-running', 'fr-dg-total'].forEach((inputId) => {
    document.getElementById(inputId)?.addEventListener('input', () => {
      const running = document.getElementById('fr-dg-running')?.value || 0;
      const total = document.getElementById('fr-dg-total')?.value || 0;
      const previewLabel = document.getElementById('lbl-dg-preview');
      if (previewLabel) previewLabel.textContent = `${running} of ${total} Running*`;
      renderReportPreview();
    });
  });

  [
    'fr-team-move',
    'fr-input-2g',
    'fr-input-4g',
    'fr-time-input',
    'fr-title-input',
    'fr-mc-format',
    'fr-pg-completed',
    'fr-pg-installed',
    'fr-pg-movement',
  ].forEach((inputId) => {
    const element = document.getElementById(inputId);
    element?.addEventListener('input', renderReportPreview);
    element?.addEventListener('change', renderReportPreview);
  });

  document.getElementById('btn-fr-generate')?.addEventListener('click', renderReportPreview);

  const copyButton = document.getElementById('btn-fr-copy');
  copyButton?.addEventListener('click', async () => {
    const previewBox = document.getElementById('fr-preview-box');
    const text = (previewBox?.value || '').trim();
    if (!text) {
      alert('Tidak ada teks untuk disalin!');
      return;
    }

    const copied = await clipboardAdapter.writeText(text);
    if (copied) {
      flashTemporaryFeedback(copyButton, '✓ Copied!', { durationMs: 1800 });
    } else {
      alert('Gagal menyalin ke clipboard.');
    }
  });

  const timeInput = document.getElementById('fr-time-input');
  if (timeInput) {
    timeInput.value = computeDefaultFlashReportTime();
  }

  return {
    renderMasterTable,
    updateStats,
    renderReportPreview,
  };
}

