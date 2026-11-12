import { getElementById } from '../../../shared/utils/dom-helpers.js';
import {
  EDITOR_FIELD_DEFS,
  buildSiteEditPayload,
  extractSiteEditorFields,
} from '../logic/site-editor-service.js';
import { upsertTeContactFromSiteEdit } from '../logic/te-contacts-service.js';

const STATUS_TONE_CLASSES = ['text-grn', 'text-red', 'text-amb'];

/**
 * Single unified controller for the Edit Database subtab (`#subtab-db-edit`).
 * Replaces the two overlapping legacy database edit blocks cleanly.
 */
export function mountDatabaseEditorView({
  appStore,
  tauriBridge,
  onRecordSiteEdit = null,
  onLoadChangesJson = null,
  onSaveChangesJson = null,
}) {
  const searchInput = getElementById('db-edit-search-inp');
  const btnSearch = getElementById('btn-db-edit-search');
  const btnClear = getElementById('btn-db-edit-clear');
  const btnSave = getElementById('btn-db-edit-save');
  const btnUndo = getElementById('btn-db-undo');
  const btnExport = getElementById('btn-db-export');
  const btnLoadJson = getElementById('btn-dbe-load-json');
  const btnSaveJson = getElementById('btn-dbe-save-json');
  const searchStatusEl = getElementById('db-edit-search-status');
  const headerStatusEl = getElementById('db-edit-status-header');
  const formContainer = getElementById('db-edit-form');

  let currentSiteData = null;
  let currentSiteId = '';
  let statusClearTimer = null;

  function setStatus(element, text, toneClass = '') {
    if (!element) return;
    element.textContent = text;
    element.classList.remove(...STATUS_TONE_CLASSES);
    if (toneClass) element.classList.add(toneClass);
  }

  function showHeaderFlash(text, toneClass, durationMs = 3000) {
    if (statusClearTimer) {
      clearTimeout(statusClearTimer);
      statusClearTimer = null;
    }
    setStatus(headerStatusEl, text, toneClass);
    if (durationMs > 0) {
      statusClearTimer = setTimeout(() => {
        setStatus(headerStatusEl, '');
      }, durationMs);
    }
  }

  function populateForm(rowData, fallbackId = '') {
    const resolved = extractSiteEditorFields(rowData, fallbackId);
    for (const def of EDITOR_FIELD_DEFS) {
      const inputEl = getElementById(def.inputId);
      if (inputEl) {
        inputEl.value = resolved[def.key] || '';
      }
    }
  }

  function collectFormPayload() {
    const rawValues = {};
    for (const def of EDITOR_FIELD_DEFS) {
      const inputEl = getElementById(def.inputId);
      rawValues[def.key] = inputEl ? inputEl.value : '';
    }
    return buildSiteEditPayload(rawValues);
  }

  async function handleSearch() {
    const query = (searchInput?.value || '').trim();
    if (!query) return;

    setStatus(searchStatusEl, 'Mencari...');
    try {
      const data = await tauriBridge.lookupSite(query);
      if (data) {
        currentSiteData = data;
        currentSiteId = query;
        setStatus(searchStatusEl, 'Site ditemukan!', 'text-grn');
        formContainer?.classList.remove('hidden');
        populateForm(data, query);
      } else {
        currentSiteData = null;
        currentSiteId = '';
        setStatus(searchStatusEl, 'Site tidak ditemukan.', 'text-red');
        formContainer?.classList.add('hidden');
      }
    } catch (err) {
      setStatus(searchStatusEl, `Error: ${err}`, 'text-red');
    }
  }

  function handleClear() {
    if (searchInput) searchInput.value = '';
    setStatus(searchStatusEl, '');
    formContainer?.classList.add('hidden');
    currentSiteData = null;
    currentSiteId = '';
  }

  async function syncTeContactAfterEdit(editData) {
    const existingContacts = appStore.getState('waTeContacts') || [];
    const updatedContacts = upsertTeContactFromSiteEdit(existingContacts, editData);
    if (updatedContacts === existingContacts) return;

    try {
      await tauriBridge.saveWhatsAppTeContacts(updatedContacts);
      appStore.setState({ waTeContacts: updatedContacts });
      appStore.emit('contacts:updated', updatedContacts);
    } catch (err) {
      console.warn('Auto-sync TE contact failed:', err);
    }
  }

  async function handleSave() {
    if (!currentSiteData) return;
    const editData = collectFormPayload();

    try {
      await tauriBridge.updateSiteDatabase(editData);
      await syncTeContactAfterEdit(editData);
      onRecordSiteEdit?.(editData.site_id, editData);
      showHeaderFlash('✅ Berhasil disimpan sementara ke memory.', 'text-grn', 3000);
    } catch (err) {
      showHeaderFlash(`❌ Gagal: ${err}`, 'text-red', 0);
    }
  }

  btnSearch?.addEventListener('click', handleSearch);
  searchInput?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleSearch();
  });
  btnClear?.addEventListener('click', handleClear);

  btnUndo?.addEventListener('click', () => {
    if (!currentSiteData) return;
    populateForm(currentSiteData, currentSiteId);
    showHeaderFlash('Perubahan dibatalkan.', 'text-amb', 2000);
  });

  btnSave?.addEventListener('click', handleSave);

  btnExport?.addEventListener('click', async () => {
    try {
      const msg = await tauriBridge.exportDatabase();
      showHeaderFlash(`✅ ${msg}`, 'text-grn', 4000);
    } catch (err) {
      showHeaderFlash(`❌ Export gagal: ${err}`, 'text-red', 0);
    }
  });

  btnLoadJson?.addEventListener('click', () => onLoadChangesJson?.());
  btnSaveJson?.addEventListener('click', () => onSaveChangesJson?.());

  return {
    searchSite: handleSearch,
    clearForm: handleClear,
  };
}

