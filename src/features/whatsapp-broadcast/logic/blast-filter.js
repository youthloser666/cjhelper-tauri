import { STORAGE_KEYS } from '../../../shared/state/storage-keys.js';
import { detectRegion } from '../../../shared/utils/region-detector.js';

export const DEFAULT_BLAST_FILTER_CONFIG = Object.freeze({
  filterRemarkTrigger: true,
  enableSitedown: true,
  enableCelldown: true,
  enableBcch: true,
  enableEnva: false,
  enableStolen: false,
  enableNetdrone: true,
});

const REMARK_TRIGGER_KEYWORDS = ['fu team', 'follow up team', 'plan ts today'];

/**
 * Loads persisted blast filter config merged safely onto defaults.
 */
export function loadBlastFilterConfig(storageAdapter) {
  const saved = storageAdapter?.getJson(STORAGE_KEYS.BLAST_FILTER_CONFIG, null);
  if (!saved || typeof saved !== 'object') {
    return { ...DEFAULT_BLAST_FILTER_CONFIG };
  }
  return { ...DEFAULT_BLAST_FILTER_CONFIG, ...saved };
}

/**
 * Saves blast filter config using the canonical storage key.
 */
export function saveBlastFilterConfig(storageAdapter, config) {
  const normalized = { ...DEFAULT_BLAST_FILTER_CONFIG, ...(config || {}) };
  storageAdapter?.setJson(STORAGE_KEYS.BLAST_FILTER_CONFIG, normalized);
  return normalized;
}

/**
 * Evaluates whether a remark satisfies auto-send trigger rules for TE blasting.
 */
export function shouldSendToTe(remark, filterConfig = DEFAULT_BLAST_FILTER_CONFIG) {
  if (!filterConfig?.filterRemarkTrigger) {
    return true;
  }

  const trimmed = String(remark || '').trim();
  if (!trimmed) {
    return true;
  }

  const lower = trimmed.toLowerCase();
  return REMARK_TRIGGER_KEYWORDS.some((kw) => lower === kw);
}

/**
 * Classifies a down site into 'sitedown', 'bcch', or 'celldown'.
 */
export function classifySiteOutageCategory(site, formatConfig = {}) {
  const impactLower = String(site?.impact || '').toLowerCase();
  const isFully = Boolean(
    site?.is_netdrone || impactLower.includes('fully') || impactLower.includes('sitedown')
  );
  if (isFully) {
    return 'sitedown';
  }

  const bcchKeyword = String(formatConfig?.key_bcch || 'BCCH').toUpperCase();
  const isBcch =
    !site?.is_netdrone && String(site?.remark || '').toUpperCase().includes(bcchKeyword);
  return isBcch ? 'bcch' : 'celldown';
}

/**
 * Computes the stable per-site selection map key preserving legacy suffix convention.
 */
export function getBlastSiteKey(site, formatConfig = {}) {
  const impactLower = String(site?.impact || '').toLowerCase();
  const bcchKeyword = String(formatConfig?.key_bcch || 'BCCH').toUpperCase();
  const isFully = impactLower.includes('fully');
  const isBcch = String(site?.remark || '').toUpperCase().includes(bcchKeyword);

  let type = 'CELLDOWN';
  if (isFully) type = 'SITEDOWN';
  else if (isBcch) type = 'BCCH';

  return `${site?.new_site || site?.site_name || ''}_${type}`;
}

/**
 * Resolves whether an individual down site is checked for TE blast delivery.
 */
export function isBlastSiteSelected(
  site,
  selectionMap = {},
  filterConfig = DEFAULT_BLAST_FILTER_CONFIG,
  formatConfig = {}
) {
  const key = getBlastSiteKey(site, formatConfig);
  if (Object.prototype.hasOwnProperty.call(selectionMap, key)) {
    return Boolean(selectionMap[key]);
  }
  if (site?.is_netdrone) {
    return true;
  }
  return shouldSendToTe(site?.remark, filterConfig);
}

/**
 * Splits DOWN sites into sitedown, celldown, and bcch lists filtered optionally by region.
 */
export function classifyDownSitesForBlast(
  statusData = [],
  { formatConfig = {}, regionFilter = 'ALL' } = {}
) {
  const sitedown = [];
  const celldown = [];
  const bcch = [];

  for (const site of statusData) {
    if (site?.status !== 'DOWN') continue;
    if (regionFilter && regionFilter !== 'ALL' && detectRegion(site) !== regionFilter) {
      continue;
    }

    const category = classifySiteOutageCategory(site, formatConfig);
    if (category === 'sitedown') sitedown.push(site);
    else if (category === 'bcch') bcch.push(site);
    else celldown.push(site);
  }

  return { sitedown, celldown, bcch };
}

/**
 * Computes selected/total counts across blast categories, Pivot alarms, and Netdrone rows.
 */
export function getBlastFilterCounts({
  statusData = [],
  pivotData = [],
  netdroneData = [],
  selectionMap = {},
  filterConfig = DEFAULT_BLAST_FILTER_CONFIG,
  formatConfig = {},
  regionFilter = 'ALL',
} = {}) {
  const { sitedown, celldown, bcch } = classifyDownSitesForBlast(statusData, {
    formatConfig,
    regionFilter,
  });

  const countSelected = (list) =>
    list.reduce(
      (acc, item) =>
        acc + (isBlastSiteSelected(item, selectionMap, filterConfig, formatConfig) ? 1 : 0),
      0
    );

  const stollenRows = pivotData.filter(
    (row) => row?.monitoring === 'STOLLEN' || row?.monitoring === 'CABLE STOLLEN'
  );
  const envaRows = pivotData.filter((row) => {
    const mon = String(row?.monitoring || '');
    return mon.includes('POWER') || mon.includes('ENVA') || mon.includes('NETECO');
  });
  const netdroneMatched = netdroneData.filter((row) => !row?.skipped && row?.matchedDb);

  return {
    sitedown: { selected: countSelected(sitedown), total: sitedown.length },
    celldown: { selected: countSelected(celldown), total: celldown.length },
    bcch: { selected: countSelected(bcch), total: bcch.length },
    stolen: stollenRows.length,
    enva: envaRows.length,
    netdrone: netdroneMatched.length,
  };
}

