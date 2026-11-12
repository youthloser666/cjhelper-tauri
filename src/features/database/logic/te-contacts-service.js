/**
 * Filters WA TE contact entries by TE name or cluster.
 */
export function filterTeContacts(contacts = [], searchTerm = '') {
  const term = String(searchTerm || '').toLowerCase().trim();
  if (!term) return [...contacts];

  return contacts.filter(
    (c) =>
      String(c.name || '').toLowerCase().includes(term) ||
      String(c.cluster || '').toLowerCase().includes(term)
  );
}

/**
 * Validates and appends a new TE contact if all required fields are filled and unique.
 */
export function addTeContact(contacts = [], { name = '', cluster = '', phone = '' } = {}) {
  const cleanName = String(name || '').trim();
  const cleanCluster = String(cluster || '').trim();
  const cleanPhone = String(phone || '').trim();

  if (!cleanName || !cleanCluster || !cleanPhone) {
    return { ok: false, reason: 'missing_fields', contacts };
  }

  const exists = contacts.some(
    (c) =>
      String(c.name || '').trim().toUpperCase() === cleanName.toUpperCase() &&
      String(c.cluster || '').trim().toUpperCase() === cleanCluster.toUpperCase()
  );

  if (exists) {
    return {
      ok: false,
      reason: 'duplicate',
      message: `Kontak dengan nama ${cleanName} di cluster ${cleanCluster} sudah ada!`,
      contacts,
    };
  }

  return {
    ok: true,
    contacts: [...contacts, { name: cleanName, cluster: cleanCluster, phone: cleanPhone }],
  };
}

/**
 * Inserts or updates a TE contact entry derived from saving a site edit form.
 */
export function upsertTeContactFromSiteEdit(contacts = [], editData = {}) {
  const teName = String(editData.te_name || '').trim();
  const tePhone = String(editData.te_phone || '').trim();
  const cluster = String(editData.cluster || editData.fm_office || '').trim();

  if (!teName || !tePhone) {
    return contacts;
  }

  const next = contacts.map((c) => ({ ...c }));
  const existing = next.find(
    (c) =>
      String(c.name || '').trim().toUpperCase() === teName.toUpperCase() &&
      String(c.cluster || '').trim().toUpperCase() === cluster.toUpperCase()
  );

  if (existing) {
    existing.phone = tePhone;
  } else {
    next.push({ name: teName, cluster, phone: tePhone });
  }
  return next;
}

/**
 * Removes incomplete rows before persisting contacts JSON to backend.
 */
export function compactTeContacts(contacts = []) {
  return (contacts || []).filter(
    (c) =>
      String(c?.name || '').trim() &&
      String(c?.cluster || '').trim() &&
      String(c?.phone || '').trim()
  );
}

