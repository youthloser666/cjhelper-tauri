import { STORAGE_KEYS } from '../../../shared/state/storage-keys.js';

export function createInitialSiteChangesState() {
  return {
    siteOverrides: {},
    handoverHistory: [],
    lastLoadedFileName: '',
  };
}

/**
 * Loads persisted site overrides and handover history from storage.
 */
export function loadSiteChangesAutosave(storageAdapter) {
  const base = createInitialSiteChangesState();
  const saved = storageAdapter?.getJson(STORAGE_KEYS.SITE_CHANGES_AUTOSAVE, null);
  if (!saved || typeof saved !== 'object') {
    return base;
  }

  return {
    siteOverrides:
      saved.overrides && typeof saved.overrides === 'object' ? { ...saved.overrides } : {},
    handoverHistory: Array.isArray(saved.handovers) ? [...saved.handovers] : [],
    lastLoadedFileName: saved.lastLoadedFileName || '',
  };
}

/**
 * Persists current site overrides and handover history under the fixed autosave key.
 */
export function saveSiteChangesAutosave(storageAdapter, state, updatedAt = new Date().toISOString()) {
  storageAdapter?.setJson(STORAGE_KEYS.SITE_CHANGES_AUTOSAVE, {
    updated_at: updatedAt,
    overrides: state.siteOverrides || {},
    handovers: state.handoverHistory || [],
  });
}

function createHandoverId(nowMs = Date.now(), randSuffix = Math.floor(Math.random() * 1000)) {
  return `ho_${nowMs}_${randSuffix}`;
}

/**
 * Records a single site handover override and history log entry.
 */
export function recordSiteHandoverChange(storageAdapter, state, record) {
  if (!record || !record.site_id) return state;
  const sid = String(record.site_id).trim().toUpperCase();
  if (!sid) return state;

  const existing = state.siteOverrides?.[sid] || {};
  const nextOverrides = {
    ...state.siteOverrides,
    [sid]: {
      site_id: sid,
      site_name: record.site_name || existing.site_name || '',
      cluster: record.cluster || existing.cluster || '',
      te_name: record.new_te || '',
      te_phone: record.new_phone || '',
      old_te: record.old_te || '',
      old_phone: record.old_phone || '',
      note: record.note || '',
      updated_at: new Date().toISOString(),
    },
  };

  const nextHistory = [
    {
      id: createHandoverId(),
      site_id: sid,
      site_name: record.site_name || '',
      cluster: record.cluster || '',
      old_te: record.old_te || '',
      old_phone: record.old_phone || '',
      new_te: record.new_te || '',
      new_phone: record.new_phone || '',
      note: record.note || '',
      timestamp: record.timestamp || new Date().toLocaleString(),
    },
    ...(state.handoverHistory || []),
  ];

  const nextState = {
    ...state,
    siteOverrides: nextOverrides,
    handoverHistory: nextHistory,
  };
  saveSiteChangesAutosave(storageAdapter, nextState);
  return nextState;
}

/**
 * Records bulk TE reassignment records cleanly into overrides and history.
 */
export function recordBulkHandoverChanges(
  storageAdapter,
  state,
  records = [],
  bulkNote = 'Handover TE Massal'
) {
  if (!Array.isArray(records) || records.length === 0) return state;
  const nowLabel = new Date().toLocaleString();
  const nextOverrides = { ...state.siteOverrides };
  const addedHistory = [];

  for (const row of records) {
    const sid = String(row.site_id || '').trim().toUpperCase();
    if (!sid) continue;

    const existing = nextOverrides[sid] || {};
    nextOverrides[sid] = {
      site_id: sid,
      site_name: row.site_name || existing.site_name || '',
      cluster: row.cluster || existing.cluster || '',
      te_name: row.new_te || '',
      te_phone: row.new_te_phone || '',
      old_te: row.old_te || '',
      old_phone: row.old_te_phone || '',
      note: bulkNote,
      updated_at: new Date().toISOString(),
    };

    addedHistory.unshift({
      id: createHandoverId(),
      site_id: sid,
      site_name: row.site_name || '',
      cluster: row.cluster || '',
      old_te: row.old_te || '',
      old_phone: row.old_te_phone || '',
      new_te: row.new_te || '',
      new_phone: row.new_te_phone || '',
      note: bulkNote,
      timestamp: nowLabel,
    });
  }

  const nextState = {
    ...state,
    siteOverrides: nextOverrides,
    handoverHistory: [...addedHistory, ...(state.handoverHistory || [])],
  };
  saveSiteChangesAutosave(storageAdapter, nextState);
  return nextState;
}

/**
 * Records manual Edit Database changes into persistent site overrides.
 */
export function recordSiteEditChange(storageAdapter, state, siteId, editData = {}) {
  const sid = String(siteId || '').trim().toUpperCase();
  if (!sid) return state;

  const existing = state.siteOverrides?.[sid] || {};
  const nextState = {
    ...state,
    siteOverrides: {
      ...state.siteOverrides,
      [sid]: {
        site_id: sid,
        site_name: editData.site_name || existing.site_name || '',
        cluster: editData.cluster || existing.cluster || '',
        te_name: editData.te_name || existing.te_name || '',
        te_phone: editData.te_phone || existing.te_phone || '',
        old_te: existing.old_te || '',
        old_phone: existing.old_phone || '',
        note: 'Edit Database Form',
        updated_at: new Date().toISOString(),
        fields: {
          ...(existing.fields || {}),
          SITE_NAME: editData.site_name,
          MC: editData.cluster,
          VENDOR: editData.vendor,
          TE_NAME: editData.te_name,
          TE_PHONE: editData.te_phone,
          TE_EMAIL: editData.te_email,
          CME_NAME: editData.cme_name,
          CME_PHONE: editData.cme_phone,
          CME_EMAIL: editData.cme_email,
          FM_OFFICE: editData.fm_office,
          HOST_NAME: editData.host_name,
          TLP: editData.tlp,
        },
      },
    },
  };

  saveSiteChangesAutosave(storageAdapter, nextState);
  return nextState;
}

/**
 * Removes a single site override and its handover history entries.
 */
export function revertSiteChange(storageAdapter, state, siteId) {
  const sid = String(siteId || '').trim().toUpperCase();
  if (!sid) return state;

  const nextOverrides = { ...state.siteOverrides };
  delete nextOverrides[sid];

  const nextHistory = (state.handoverHistory || []).filter(
    (entry) => String(entry.site_id || '').trim().toUpperCase() !== sid
  );

  const nextState = {
    ...state,
    siteOverrides: nextOverrides,
    handoverHistory: nextHistory,
  };
  saveSiteChangesAutosave(storageAdapter, nextState);
  return nextState;
}

/**
 * Clears all site overrides and removes the persisted autosave key.
 */
export function resetAllSiteChanges(storageAdapter) {
  storageAdapter?.remove(STORAGE_KEYS.SITE_CHANGES_AUTOSAVE);
  return createInitialSiteChangesState();
}

/**
 * Builds the schema_version=1 JSON payload for saving `.json` site changes files.
 */
export function exportSiteChangesJsonPayload(state, exportedAt = new Date().toISOString()) {
  const overrides = state.siteOverrides || {};
  const handovers = state.handoverHistory || [];
  return {
    app: 'CJHelper',
    schema_version: 1,
    exported_at: exportedAt,
    stats: {
      total_modified_sites: Object.keys(overrides).length,
      total_handover_logs: handovers.length,
    },
    handovers,
    overrides,
  };
}

/**
 * Parses and merges an external `.json` overrides/handovers file onto current state cleanly.
 */
export function parseAndMergeSiteChangesJson(storageAdapter, state, jsonContent, fileName = '') {
  const parsed = JSON.parse(jsonContent);
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Format file JSON tidak valid.');
  }

  let loadedOverrides = {};
  let loadedHandovers = [];

  if (parsed.overrides && typeof parsed.overrides === 'object') {
    loadedOverrides = parsed.overrides;
  } else if (parsed.site_overrides && typeof parsed.site_overrides === 'object') {
    loadedOverrides = parsed.site_overrides;
  } else if (!parsed.handovers && typeof parsed === 'object') {
    loadedOverrides = parsed;
  }

  if (Array.isArray(parsed.handovers)) {
    loadedHandovers = parsed.handovers;
  } else if (Array.isArray(parsed.handover_records)) {
    loadedHandovers = parsed.handover_records;
  }

  const nextOverrides = { ...state.siteOverrides };
  for (const sid of Object.keys(loadedOverrides)) {
    const normalizedId = sid.trim().toUpperCase();
    if (normalizedId) {
      nextOverrides[normalizedId] = loadedOverrides[sid];
    }
  }

  const existingIds = new Set(
    (state.handoverHistory || []).map((entry) => entry.id || `${entry.site_id}${entry.timestamp}`)
  );
  const nextHistory = [...(state.handoverHistory || [])];
  for (const entry of loadedHandovers) {
    const idKey = entry.id || `${entry.site_id}${entry.timestamp}`;
    if (!existingIds.has(idKey)) {
      nextHistory.push(entry);
      existingIds.add(idKey);
    }
  }

  const nextState = {
    siteOverrides: nextOverrides,
    handoverHistory: nextHistory,
    lastLoadedFileName: fileName || state.lastLoadedFileName || '',
  };
  saveSiteChangesAutosave(storageAdapter, nextState);
  return nextState;
}

/**
 * Filters handover history records against a search query.
 */
export function filterHandoverHistory(handoverHistory = [], filterText = '') {
  const term = String(filterText || '').trim().toLowerCase();
  if (!term) return [...handoverHistory];

  return handoverHistory.filter((entry) =>
    [entry.site_id, entry.site_name, entry.cluster, entry.new_te, entry.old_te].some((val) =>
      String(val || '').toLowerCase().includes(term)
    )
  );
}

