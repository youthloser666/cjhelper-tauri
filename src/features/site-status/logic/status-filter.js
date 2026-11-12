import { detectRegion } from '../../../shared/utils/region-detector.js';

/**
 * Filters site status entries by region, status ("ALL" | "DOWN" | "UP"),
 * and search term, then sorts by duration or RTS order.
 */
export function filterAndSortSiteStatuses(
  statusData = [],
  {
    regionFilter = 'ALL',
    statusFilter = 'ALL',
    searchQuery = '',
    sortOrder = 'none',
  } = {}
) {
  let filtered = Array.isArray(statusData) ? statusData : [];

  if (regionFilter && regionFilter !== 'ALL') {
    filtered = filtered.filter((site) => detectRegion(site) === regionFilter);
  }

  if (statusFilter && statusFilter !== 'ALL') {
    filtered = filtered.filter((site) => site.status === statusFilter);
  }

  const normalizedQuery = String(searchQuery || '').toLowerCase().trim();
  if (normalizedQuery) {
    filtered = filtered.filter(
      (site) =>
        (site.cluster || '').toLowerCase().includes(normalizedQuery) ||
        (site.site_name || '').toLowerCase().includes(normalizedQuery) ||
        (site.new_site || '').toLowerCase().includes(normalizedQuery)
    );
  }

  if (sortOrder !== 'none') {
    return [...filtered].sort((firstSite, secondSite) => {
      if (sortOrder === 'desc') {
        return (firstSite.start_timestamp || 0) - (secondSite.start_timestamp || 0);
      }
      return (secondSite.start_timestamp || 0) - (firstSite.start_timestamp || 0);
    });
  }

  return [...filtered].sort((firstSite, secondSite) => {
    if (!firstSite.rts) return 1;
    if (!secondSite.rts) return -1;
    return firstSite.rts.localeCompare(secondSite.rts);
  });
}

/**
 * Computes UP and DOWN site counts scoped to the active region filter.
 */
export function computeStatusCounts(statusData = [], regionFilter = 'ALL') {
  const scopedSites =
    regionFilter && regionFilter !== 'ALL'
      ? (statusData || []).filter((site) => detectRegion(site) === regionFilter)
      : statusData || [];

  let upCount = 0;
  let downCount = 0;

  for (const site of scopedSites) {
    if (site.status === 'UP') {
      upCount += 1;
    } else {
      downCount += 1;
    }
  }

  return { upCount, downCount };
}

/**
 * Maps a status item's impact and aging values into semantic badge class names.
 */
export function resolveStatusBadges(site = {}) {
  const impactLower = (site.impact || '').toLowerCase();
  const agingText = site.agging || '';

  const impactClass = impactLower.includes('fully') ? 'br' : 'bb';

  let agingClass = 'bb';
  if (agingText.includes('d') || agingText.includes('day')) {
    agingClass = 'br';
  } else if (agingText.includes('24') || agingText.includes('8-24')) {
    agingClass = 'ba';
  }

  return { impactClass, agingClass };
}

