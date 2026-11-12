/**
 * Collects unique, sorted valid TE names from TE contacts and active site statuses.
 */
export function collectHandoverTeNames(savedTeContacts = [], statusData = []) {
  const namesSet = new Set();

  const tryAdd = (rawName) => {
    const trimmed = String(rawName || '').trim();
    if (
      trimmed &&
      !trimmed.startsWith('[') &&
      trimmed.toUpperCase() !== 'UNKNOWN TE' &&
      trimmed !== '—' &&
      trimmed !== '0'
    ) {
      namesSet.add(trimmed);
    }
  };

  for (const contact of savedTeContacts || []) tryAdd(contact?.name);
  for (const site of statusData || []) tryAdd(site?.pic);

  return Array.from(namesSet).sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: 'base' })
  );
}

/**
 * Collects registered unique TE contact options sorted alphabetically by name.
 */
export function collectRegisteredTeOptions(savedTeContacts = []) {
  const teMap = new Map();
  for (const contact of savedTeContacts || []) {
    const name = String(contact?.name || '').trim();
    if (!name || name.startsWith('[') || name.toUpperCase() === 'UNKNOWN TE') continue;
    const key = name.toUpperCase();
    if (!teMap.has(key)) {
      teMap.set(key, {
        name,
        cluster: String(contact?.cluster || '').trim(),
        phone: String(contact?.phone || '').trim(),
      });
    }
  }
  return Array.from(teMap.values()).sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Computes affected cluster list, phone number, and in-memory site count for a TE being replaced.
 */
export function computeTeHandoverPreview(oldTeName, savedTeContacts = [], statusData = []) {
  const clustersSet = new Set();
  let contactPhone = '';
  let siteCount = 0;

  const targetUpper = String(oldTeName || '').trim().toUpperCase();
  if (!targetUpper) {
    return { clusters: [], contactPhone: '', siteCount: 0 };
  }

  for (const contact of savedTeContacts || []) {
    if (String(contact?.name || '').trim().toUpperCase() === targetUpper) {
      if (contact.cluster) clustersSet.add(String(contact.cluster).trim());
      if (!contactPhone && contact.phone) contactPhone = String(contact.phone).trim();
    }
  }

  for (const site of statusData || []) {
    if (String(site?.pic || '').trim().toUpperCase() === targetUpper) {
      siteCount += 1;
      if (site.cluster) clustersSet.add(String(site.cluster).trim());
    }
  }

  return {
    clusters: Array.from(clustersSet).sort(),
    contactPhone,
    siteCount,
  };
}

/**
 * Validates required fields for bulk TE reassignment.
 */
export function validateBulkTeHandoverInput({ oldTeName = '', newTeName = '' } = {}) {
  if (!String(oldTeName || '').trim()) {
    return { ok: false, message: 'Harap pilih TE lama yang akan diganti.' };
  }
  if (!String(newTeName || '').trim()) {
    return { ok: false, message: 'Harap masukkan nama TE baru.' };
  }
  return { ok: true };
}

/**
 * Splits multi-line or delimited batch Site ID input into deduplicated/normalized uppercase tokens.
 */
export function parseBatchSiteIds(rawText = '') {
  return String(rawText || '')
    .split(/[\n,; \t]+/)
    .map((token) => token.trim().toUpperCase())
    .filter((token) => token.length > 0);
}

/**
 * Validates required fields for single/batch site handover execution.
 */
export function validateSiteHandoverRequest({ newTeName = '', siteIds = [] } = {}) {
  if (!String(newTeName || '').trim()) {
    return { ok: false, message: 'Harap pilih atau ketik nama TE Baru penerima handover.' };
  }
  if (!Array.isArray(siteIds) || siteIds.length === 0) {
    return { ok: false, message: 'Harap pilih minimal 1 Site ID untuk handover.' };
  }
  return { ok: true };
}

