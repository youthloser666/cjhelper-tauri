import { createModalController } from '../../../shared/ui/modal-controller.js';
import { escapeHtml, getElementById } from '../../../shared/utils/dom-helpers.js';
import {
  exportSiteChangesJsonPayload,
  filterHandoverHistory,
  loadSiteChangesAutosave,
  parseAndMergeSiteChangesJson,
  recordBulkHandoverChanges,
  recordSiteEditChange,
  recordSiteHandoverChange,
  resetAllSiteChanges,
  revertSiteChange,
} from '../logic/site-changes-manager.js';
import {
  collectRegisteredTeOptions,
  parseBatchSiteIds,
  validateSiteHandoverRequest,
} from '../logic/handover-service.js';

/**
 * Controls the Handover New Site / BTS modal (`#modal-handover-site`) and centralized
 * persistent site overrides / handover history lifecycle (`SiteChangesManager`).
 */
export function mountHandoverSiteModalView({
  appStore,
  tauriBridge,
  storageAdapter,
}) {
  const modalEl = getElementById('modal-handover-site');
  const closeXBtn = getElementById('btn-close-handover-site-x');
  const closeBtn = getElementById('btn-close-handover-site');
  const tabSingle = getElementById('hos-tab-single');
  const tabBatch = getElementById('hos-tab-batch');
  const paneSingle = getElementById('hos-pane-single');
  const paneBatch = getElementById('hos-pane-batch');

  const inpSearchSite = getElementById('inp-hos-search-site');
  const btnCheckSite = getElementById('btn-hos-check-site');
  const btnClearSite = getElementById('btn-hos-clear-site');

  const prevSiteName = getElementById('hos-prev-site-name');
  const prevSiteId = getElementById('hos-prev-site-id');
  const prevCluster = getElementById('hos-prev-cluster');
  const prevOldTe = getElementById('hos-prev-old-te');
  const prevOldPhone = getElementById('hos-prev-old-phone');

  const inpBatchSites = getElementById('inp-hos-batch-sites');
  const btnBatchValidate = getElementById('btn-hos-batch-validate');
  const batchCountInfo = getElementById('hos-batch-count-info');

  const selNewTe = getElementById('sel-hos-new-te');
  const inpNewTe = getElementById('inp-hos-new-te');
  const inpNewPhone = getElementById('inp-hos-new-phone');
  const inpNote = getElementById('inp-hos-note');
  const btnExecute = getElementById('btn-execute-handover-site');

  const historyBadge = getElementById('hos-history-badge');
  const inpFilterHistory = getElementById('inp-hos-filter-history');
  const historyTbody = getElementById('hos-history-tbody');
  const btnLoadJson = getElementById('btn-hos-load-json');
  const btnSaveJson = getElementById('btn-hos-save-json');
  const btnResetAll = getElementById('btn-hos-reset-all');

  let changesState = loadSiteChangesAutosave(storageAdapter);
  let currentActiveSiteData = null;
  let currentMode = 'single';

  const modalController = createModalController(modalEl, {
    closeButtonSelector: '#btn-close-handover-site-x, #btn-close-handover-site',
  });

  closeXBtn?.addEventListener('click', () => modalController.close('close-x'));
  closeBtn?.addEventListener('click', () => modalController.close('close'));

  function syncStoreFromChangesState() {
    appStore.setState({
      siteChanges: {
        updated_at: new Date().toISOString(),
        overrides: changesState.siteOverrides,
        handovers: changesState.handoverHistory,
      },
      lastLoadedChangesFileName: changesState.lastLoadedFileName,
    });
  }

  function applyTeOverridesToStatusData(siteOverridePairs = []) {
    const currentStatuses = appStore.getState('statusData') || [];
    if (currentStatuses.length === 0 || siteOverridePairs.length === 0) return;

    const mapById = new Map(
      siteOverridePairs.map(([sid, ov]) => [String(sid).toUpperCase(), ov])
    );

    let changed = false;
    const nextStatuses = currentStatuses.map((site) => {
      const sid = String(site.new_site || '').trim().toUpperCase();
      const ov = mapById.get(sid);
      if (!ov) return site;
      if (!ov.te_name && !ov.te_phone) return site;
      changed = true;
      return {
        ...site,
        pic: ov.te_name || site.pic,
        te_phone: ov.te_phone || site.te_phone,
      };
    });

    if (changed) {
      appStore.setState({ statusData: nextStatuses });
    }
  }

  function renderHistoryTable() {
    if (historyBadge) {
      const totalSites = Object.keys(changesState.siteOverrides).length;
      historyBadge.textContent = `${totalSites} site`;
    }

    if (!historyTbody) return;
    const filterTerm = inpFilterHistory?.value || '';
    const records = filterHandoverHistory(changesState.handoverHistory, filterTerm);

    if (records.length === 0) {
      historyTbody.innerHTML = `
        <tr>
          <td colspan="7" class="hos-empty-cell">
            ${filterTerm ? 'Tidak ada riwayat perubahan yang cocok dengan pencarian.' : 'Belum ada site yang diubah di sesi ini.'}
          </td>
        </tr>
      `;
      return;
    }

    historyTbody.innerHTML = records
      .map(
        (rec) => `
          <tr class="hos-row">
            <td class="hos-td font-mono font-semibold text-primary-1">${escapeHtml(rec.site_id || '—')}</td>
            <td class="hos-td text-muted-2">${escapeHtml(rec.site_name || '—')}</td>
            <td class="hos-td text-muted-2">${escapeHtml(rec.cluster || '—')}</td>
            <td class="hos-td text-amb">${escapeHtml(rec.old_te || '—')}</td>
            <td class="hos-td font-semibold text-accent">
              ${escapeHtml(rec.new_te || '—')} ${rec.new_phone ? `<span class="fr-empty-dash">(${escapeHtml(rec.new_phone)})</span>` : ''}
            </td>
            <td class="hos-td fr-empty-dash">
              ${escapeHtml(rec.timestamp || '—')}
              ${rec.note ? `<div class="text-muted-2 italic">${escapeHtml(rec.note)}</div>` : ''}
            </td>
            <td class="hos-td text-center">
              <button type="button" class="tbtn-clr btn-hos-revert-row" data-site="${escapeHtml(rec.site_id)}"
                title="Hapus override site ini">Revert</button>
            </td>
          </tr>
        `
      )
      .join('');

    historyTbody.querySelectorAll('.btn-hos-revert-row').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const sid = e.currentTarget.dataset.site;
        if (
          !confirm(
            `Batalkan perubahan untuk site ${sid}? Site akan kembali ke data Master DB saat di-reload.`
          )
        ) {
          return;
        }
        changesState = revertSiteChange(storageAdapter, changesState, sid);
        syncStoreFromChangesState();
        renderHistoryTable();
        alert(`Perubahan untuk site ${sid} telah dihapus dari daftar override.`);
      });
    });
  }

  function commitChangesState(nextState, overridePairs = []) {
    changesState = nextState;
    applyTeOverridesToStatusData(overridePairs);
    syncStoreFromChangesState();
    renderHistoryTable();
  }

  async function applyToMemory(silent = false, isAutoOnLoad = false) {
    const entries = Object.entries(changesState.siteOverrides);
    if (entries.length === 0) {
      if (!silent) alert('Belum ada data perubahan site yang tersimpan.');
      return;
    }

    try {
      const applyResult = await tauriBridge.applySiteChanges({
        overrides: changesState.siteOverrides,
      });

      applyTeOverridesToStatusData(entries);
      syncStoreFromChangesState();
      renderHistoryTable();

      const appliedCount = applyResult?.applied_count || 0;
      const notFoundCount = Array.isArray(applyResult?.not_found) ? applyResult.not_found.length : 0;

      if (!silent) {
        let msg = `✅ Berhasil menerapkan ${appliedCount} perubahan site ke memory!`;
        if (notFoundCount > 0) {
          msg += `\n⚠️ ${notFoundCount} site tidak ditemukan di Master DB (mungkin beda database).`;
        }
        alert(msg);
      } else if (isAutoOnLoad && appliedCount > 0) {
        console.log(
          `[Auto-Apply] ${appliedCount} perubahan site otomatis diterapkan dari perubahan tersimpan.`
        );
      }
    } catch (err) {
      if (!silent) {
        alert(`Gagal menerapkan perubahan ke database: ${err}`);
      } else {
        console.warn('Gagal auto-apply perubahan site:', err);
      }
    }
  }

  async function saveToJsonFile() {
    const count = Object.keys(changesState.siteOverrides).length;
    if (count === 0 && changesState.handoverHistory.length === 0) {
      alert(
        'Belum ada data site yang diubah. Lakukan Handover Site / BTS atau Edit Database terlebih dahulu.'
      );
      return;
    }

    const payload = exportSiteChangesJsonPayload(changesState);
    const dateStr = new Date().toISOString().slice(0, 10);
    const defaultFilename = `cjhelper_site_changes_${dateStr}.json`;

    try {
      const savedPath = await tauriBridge.saveChangesJsonFile({
        jsonContent: JSON.stringify(payload, null, 2),
        defaultFilename,
      });
      if (savedPath) {
        const fileName = savedPath.split(/[\\/]/).pop();
        changesState = { ...changesState, lastLoadedFileName: fileName };
        syncStoreFromChangesState();
        alert(
          `✅ Berhasil menyimpan file perubahan:\n${savedPath}\n\nTotal: ${count} site tersimpan.`
        );
      }
    } catch (err) {
      alert(`Gagal menyimpan file .json: ${err}`);
    }
  }

  async function loadFromJsonFile() {
    try {
      const selectedPath = await tauriBridge.pickJsonFile();
      if (!selectedPath) return;

      const fileName = selectedPath.split(/[\\/]/).pop();
      const content = await tauriBridge.readJsonFile(selectedPath);
      changesState = parseAndMergeSiteChangesJson(
        storageAdapter,
        changesState,
        content,
        fileName
      );
      await applyToMemory(false);
    } catch (err) {
      alert(`Gagal memuat file .json: ${err}`);
    }
  }

  function switchMode(mode) {
    currentMode = mode;
    const isSingle = mode === 'single';
    tabSingle?.classList.toggle('active', isSingle);
    tabBatch?.classList.toggle('active', !isSingle);
    paneSingle?.classList.toggle('hidden', !isSingle);
    paneBatch?.classList.toggle('hidden', isSingle);
  }

  function clearSitePreview() {
    currentActiveSiteData = null;
    if (inpSearchSite) inpSearchSite.value = '';
    if (prevSiteName) prevSiteName.textContent = 'Belum dipilih';
    if (prevSiteId) prevSiteId.textContent = '—';
    if (prevCluster) prevCluster.textContent = '—';
    if (prevOldTe) prevOldTe.textContent = '—';
    if (prevOldPhone) prevOldPhone.textContent = '—';
  }

  async function searchSiteForHandover(siteIdInput = '') {
    const normalizedSiteId = String(siteIdInput || inpSearchSite?.value || '').trim().toUpperCase();
    if (!normalizedSiteId) {
      alert('Harap masukkan Site ID terlebih dahulu.');
      return;
    }

    try {
      const siteLookup = await tauriBridge.lookupSite(normalizedSiteId);
      if (!siteLookup) {
        alert(`Site ID '${normalizedSiteId}' tidak ditemukan di Master Database.`);
        clearSitePreview();
        return;
      }

      currentActiveSiteData = siteLookup;
      if (prevSiteName) prevSiteName.textContent = siteLookup['Site Name'] || '—';
      if (prevSiteId) {
        prevSiteId.textContent = `New ID: ${siteLookup['Site ID (New)'] || normalizedSiteId} | Old: ${siteLookup['Old Site ID'] || '—'}`;
      }
      if (prevCluster) prevCluster.textContent = siteLookup['Cluster (MC)'] || siteLookup['FM Office'] || '—';
      if (prevOldTe) prevOldTe.textContent = siteLookup['TE Name'] || '(Belum ditentukan)';
      if (prevOldPhone) prevOldPhone.textContent = siteLookup['TE Phone'] || '—';
    } catch (err) {
      alert(`Gagal mencari site di database: ${err}`);
      clearSitePreview();
    }
  }

  function populateNewTeSelect() {
    if (!selNewTe) return;
    selNewTe.innerHTML = '<option value="">-- Pilih TE Terdaftar --</option>';
    const options = collectRegisteredTeOptions(appStore.getState('waTeContacts') || []);
    for (const contact of options) {
      const opt = document.createElement('option');
      opt.value = contact.name;
      opt.textContent = `${contact.name} ${contact.cluster ? `(${contact.cluster})` : ''}`;
      opt.dataset.phone = contact.phone;
      selNewTe.appendChild(opt);
    }
  }

  function open(prefilledSiteId = '') {
    populateNewTeSelect();
    if (inpNewTe) inpNewTe.value = '';
    if (inpNewPhone) inpNewPhone.value = '';
    if (inpNote) inpNote.value = '';

    switchMode('single');
    if (prefilledSiteId) {
      if (inpSearchSite) inpSearchSite.value = prefilledSiteId;
      searchSiteForHandover(prefilledSiteId);
    }

    renderHistoryTable();
    modalController.open();
  }

  tabSingle?.addEventListener('click', () => switchMode('single'));
  tabBatch?.addEventListener('click', () => switchMode('batch'));
  btnCheckSite?.addEventListener('click', () => searchSiteForHandover());
  inpSearchSite?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') searchSiteForHandover();
  });
  btnClearSite?.addEventListener('click', clearSitePreview);

  selNewTe?.addEventListener('change', () => {
    const selectedOpt = selNewTe.options[selNewTe.selectedIndex];
    if (selectedOpt?.value) {
      if (inpNewTe) inpNewTe.value = selectedOpt.value;
      if (inpNewPhone) inpNewPhone.value = selectedOpt.dataset.phone || '';
    }
  });

  inpBatchSites?.addEventListener('input', () => {
    const ids = parseBatchSiteIds(inpBatchSites.value);
    if (batchCountInfo) batchCountInfo.textContent = `${ids.length} Site ID dimasukkan`;
  });

  btnBatchValidate?.addEventListener('click', async () => {
    const ids = parseBatchSiteIds(inpBatchSites?.value || '');
    if (ids.length === 0) {
      alert('Masukkan minimal 1 Site ID di textarea terlebih dahulu.');
      return;
    }

    let found = 0;
    let notFound = 0;
    for (const candidateSiteId of ids) {
      try {
        const lookupMatch = await tauriBridge.lookupSite(candidateSiteId);
        if (lookupMatch) found += 1;
        else notFound += 1;
      } catch {
        notFound += 1;
      }
    }

    alert(
      `Hasil Validasi DB:\n• ${found} site terdaftar di Master DB.\n• ${notFound} site tidak ditemukan.`
    );
    if (batchCountInfo) {
      batchCountInfo.textContent = `${ids.length} Site ID (${found} valid di DB)`;
    }
  });

  btnExecute?.addEventListener('click', async () => {
    const newTeName = (inpNewTe?.value || selNewTe?.value || '').trim();
    const newTePhone = (inpNewPhone?.value || '').trim();
    const note = (inpNote?.value || '').trim();

    let targetSiteIds = [];
    if (currentMode === 'single') {
      if (!currentActiveSiteData) {
        const typed = (inpSearchSite?.value || '').trim().toUpperCase();
        if (typed) {
          await searchSiteForHandover(typed);
        }
      }
      if (currentActiveSiteData) {
        targetSiteIds.push(
          currentActiveSiteData['Site ID (New)'] || inpSearchSite?.value.trim().toUpperCase()
        );
      }
    } else {
      targetSiteIds = parseBatchSiteIds(inpBatchSites?.value || '');
    }

    const validation = validateSiteHandoverRequest({ newTeName, siteIds: targetSiteIds });
    if (!validation.ok) {
      alert(validation.message);
      return;
    }

    const confirmMsg =
      `Konfirmasi Handover Site / BTS:\n\n` +
      `• Jumlah Site: ${targetSiteIds.length} site\n` +
      `• Target TE Baru: ${newTeName}\n` +
      `• Nomor WA: ${newTePhone || '(tidak diisi)'}\n` +
      `• Catatan: ${note || '-'}\n\n` +
      `Lanjutkan proses handover?`;
    if (!confirm(confirmMsg)) return;

    btnExecute.disabled = true;
    btnExecute.textContent = '⏳ Memproses...';

    try {
      const batchResponse = await tauriBridge.handoverSitesBatch({
        siteIds: targetSiteIds,
        newTeName,
        newTePhone,
        note: note || null,
      });

      const records = batchResponse?.records || [];
      const successes = records.filter((record) => record.success);
      const fails = records.filter((record) => !record.success);

      let nextState = changesState;
      const overridePairs = [];
      for (const successRecord of successes) {
        nextState = recordSiteHandoverChange(storageAdapter, nextState, successRecord);
        overridePairs.push([
          successRecord.site_id,
          { te_name: successRecord.new_te, te_phone: successRecord.new_phone },
        ]);
      }
      commitChangesState(nextState, overridePairs);

      let alertMsg =
        `✅ Handover Berhasil!\n\n` +
        `• ${successes.length} site berhasil dialihkan ke ${newTeName}.\n`;
      if (fails.length > 0) {
        alertMsg +=
          `⚠️ ${fails.length} site gagal (tidak ditemukan di DB):\n` +
          fails
            .slice(0, 5)
            .map((f) => `  - ${f.site_id}: ${f.message}`)
            .join('\n') +
          (fails.length > 5 ? `\n  ... dan ${fails.length - 5} lainnya` : '');
      }
      alert(alertMsg);

      if (currentMode === 'single') {
        clearSitePreview();
      } else {
        if (inpBatchSites) inpBatchSites.value = '';
        if (batchCountInfo) batchCountInfo.textContent = '0 Site ID dimasukkan';
      }
      if (inpNote) inpNote.value = '';
    } catch (err) {
      alert(`Gagal memproses handover site: ${err}`);
    } finally {
      btnExecute.disabled = false;
      btnExecute.textContent = '⚡ Terapkan Handover Site';
    }
  });

  inpFilterHistory?.addEventListener('input', renderHistoryTable);
  btnLoadJson?.addEventListener('click', loadFromJsonFile);
  btnSaveJson?.addEventListener('click', saveToJsonFile);
  btnResetAll?.addEventListener('click', () => {
    const total = Object.keys(changesState.siteOverrides).length;
    if (total === 0) {
      alert('Tidak ada perubahan yang aktif.');
      return;
    }
    if (
      !confirm(
        `Apakah Anda yakin ingin menghapus SEMUA (${total}) perubahan site yang tersimpan?`
      )
    ) {
      return;
    }
    commitChangesState(resetAllSiteChanges(storageAdapter));
    alert('Semua override perubahan site telah di-reset.');
  });

  syncStoreFromChangesState();
  renderHistoryTable();

  return {
    open,
    applyToMemory,
    saveToJsonFile,
    loadFromJsonFile,
    recordSiteEdit(siteId, editData) {
      const next = recordSiteEditChange(storageAdapter, changesState, siteId, editData);
      commitChangesState(
        next,
        editData?.te_name ? [[siteId, { te_name: editData.te_name, te_phone: editData.te_phone }]] : []
      );
    },
    recordBulkHandover(records, bulkNote) {
      const next = recordBulkHandoverChanges(storageAdapter, changesState, records, bulkNote);
      const pairs = (records || []).map((r) => [
        r.site_id,
        { te_name: r.new_te, te_phone: r.new_te_phone },
      ]);
      commitChangesState(next, pairs);
    },
  };
}
