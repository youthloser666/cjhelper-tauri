/**
 * Formats one site status entry into the clipboard line format.
 */
export function formatSiteStatusClipboardLine(site = {}) {
  return `${site.new_site || ''} - ${site.site_name || ''} - ${site.cluster || ''} ${site.icon || ''}`;
}

/**
 * Filters and formats a batch of site status entries ("DOWN" | "UP" | "ALL")
 * for bulk clipboard copying.
 */
export function formatSiteStatusBatchCopy(statusData = [], targetStatus = 'ALL') {
  const items =
    targetStatus === 'DOWN' || targetStatus === 'UP'
      ? (statusData || []).filter((site) => site.status === targetStatus)
      : statusData || [];

  return items.map(formatSiteStatusClipboardLine).join('\n');
}

