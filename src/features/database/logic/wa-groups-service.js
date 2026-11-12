/**
 * Filters WhatsApp groups by group name substring.
 */
export function filterWaGroups(waGroups = [], filterText = '') {
  const term = String(filterText || '').trim().toLowerCase();
  if (!term) return [...waGroups];
  return waGroups.filter((g) => String(g.name || '').toLowerCase().includes(term));
}

/**
 * Maps selected WhatsApp group IDs into the backend saved_groups payload schema.
 */
export function buildSavedWaGroupsPayload(waGroups = [], selectedGroupIds = new Set()) {
  return waGroups
    .filter((g) => selectedGroupIds.has(g.id))
    .map((g) => ({
      group_id: g.id,
      group_name: g.name,
    }));
}

/**
 * Formats the visible vs total group count badge text.
 */
export function formatWaGroupCountLabel({ total = 0, visible = 0, selected = 0, filter = '' } = {}) {
  if (filter) {
    return `${visible}/${total} (${selected} terpilih)`;
  }
  return `${selected} terpilih`;
}

