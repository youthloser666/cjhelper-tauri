import { formatBroadcastIsoTimestamp } from '../../../shared/utils/date-time.js';

const SITE_ID_PATTERN = /([0-9]{2}[A-Z]{3}[0-9]{4})/i;
const PLACEHOLDER_OWNERS = new Set([
  '',
  '-',
  '—',
  '0',
  'null',
  'nan',
  'n/a',
  'na',
  'none',
  'unknown',
  'untitled',
  'te unknown',
  'belum ada te',
]);
const PRIORITY_ONLY_TOKENS = new Set([
  'A',
  'B',
  'C',
  'HIGH',
  'VERY HIGH',
  'MEDIUM',
  'LOW',
  'STANDARD',
  'REGULAR',
  'CRITICAL',
]);
const SINGLE_LETTER_CLASS_TOKENS = new Set(['A', 'B', 'C']);

function isUntitledOwner(value) {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (PLACEHOLDER_OWNERS.has(normalized)) return true;
  return normalized.startsWith('te unknown') || normalized.startsWith('untitled');
}

function resolveRtsName(site) {
  if (!isUntitledOwner(site.rts)) return String(site.rts).trim();
  return '-';
}

function resolveOwnerName(site) {
  if (site.owner && !isUntitledOwner(site.owner)) return site.owner;
  if (!isUntitledOwner(site.pic)) return String(site.pic).trim();
  if (!isUntitledOwner(site.rts)) return String(site.rts).trim();
  return site.rts || site.pic || '-';
}

function resolveHubType(site) {
  if (site._categoryOverride) return site._categoryOverride;
  const explicitHub = String(site.hub_type || site.hubType || '').trim();
  if (explicitHub) return explicitHub;

  const cat = String(site.category || '').trim();
  if (cat && cat.length > 2 && !PRIORITY_ONLY_TOKENS.has(cat.toUpperCase())) {
    return cat;
  }

  const cls = String(site.site_class || '').trim();
  if (cls && (cls.toUpperCase().includes('HUB') || cls.toUpperCase().includes('END SITE'))) {
    return cls;
  }
  return 'END SITE';
}

function resolveTrafficLabel(site) {
  const hasExplicitTrafficProp = Object.prototype.hasOwnProperty.call(site, 'traffic');
  const directTraffic = String(site.traffic ?? '').trim();
  if (directTraffic && !isUntitledOwner(directTraffic)) return directTraffic;

  const explicitPriority = String(site.priority || site.priorityLabel || '').trim();
  if (explicitPriority && !isUntitledOwner(explicitPriority)) return explicitPriority;

  // When Rust/parser provided `traffic` explicitly and it's blank, don't leak Master Site Class A/B/C.
  if (hasExplicitTrafficProp) {
    return '-';
  }

  const cls = String(site.site_class || '').trim();
  if (
    cls &&
    !SINGLE_LETTER_CLASS_TOKENS.has(cls.toUpperCase()) &&
    !cls.toUpperCase().includes('HUB') &&
    !cls.toUpperCase().includes('END SITE')
  ) {
    return cls;
  }
  return '-';
}

/**
 * Extracts the link pair label after '|' from Pivot Ring/Link/Remark columns.
 */
export function extractLinkPairLabel(pivotRow = {}) {
  const rawCandidate = String(
    pivotRow.ring || pivotRow.link || pivotRow.remark || ''
  ).trim();
  if (!rawCandidate) return '';
  if (rawCandidate.includes('|')) {
    const afterPipe = rawCandidate.split('|').slice(1).join('|').trim();
    if (afterPipe) return afterPipe;
  }
  return rawCandidate;
}

/**
 * Formats a Unix epoch timestamp into the standard DD/MM/YYYY | HH:MM UTC string.
 */
export function formatUtcTimestampDisplay(startTimestamp, fallbackTime = '') {
  if (!startTimestamp || Number(startTimestamp) <= 0) {
    return fallbackTime || '';
  }

  const date = new Date(Number(startTimestamp) * 1000);
  const day = String(date.getUTCDate()).padStart(2, '0');
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const year = date.getUTCFullYear();
  const hours = String(date.getUTCHours()).padStart(2, '0');
  const minutes = String(date.getUTCMinutes()).padStart(2, '0');
  return `${day}/${month}/${year} | ${hours}:${minutes}`;
}

/**
 * Formats a single site outage entry using the supplied FormattingConfig template.
 */
export function formatSingleLine(site, formatConfig, showRemarkOverride, options = {}) {
  const impactLower = (site.impact || '').toLowerCase();
  const isFully = Boolean(
    site.is_netdrone || impactLower.includes('fully') || impactLower.includes('sitedown')
  );
  const typeRaw = isFully ? 'SITE DOWN' : 'CELLS DOWN';

  const combinedMeta = `${site.category || ''} ${site.hub_type || ''} ${site.impact || ''}`
    .toUpperCase()
    .replace(/[-_\s]+/g, ' ');
  const isHub =
    combinedMeta.includes('HUB') &&
    (combinedMeta.includes('MEDIUM') || combinedMeta.includes('BIG'));
  const isCritical = `${site.traffic || ''} ${site.site_class || ''} ${site.priority || ''}`
    .toUpperCase()
    .includes('CRITICAL');

  const iconChar = isHub || isCritical ? '⚠️ ' : `${formatConfig.icon_down || '▶️'} `;
  const timeStr =
    options?.timeFormat === 'iso'
      ? formatBroadcastIsoTimestamp(site.start_timestamp, site.start_time || '')
      : formatUtcTimestampDisplay(site.start_timestamp, site.start_time || '');

  const hubType = resolveHubType(site);
  const trafficLabel = resolveTrafficLabel(site);
  const rtsName = resolveRtsName(site);
  const ownerName = resolveOwnerName(site);

  const templateContext = {
    icon: iconChar.trim(),
    type: typeRaw,
    cluster: site.cluster || '',
    sitename: site.site_name || '',
    old: site.old_site || '',
    new: site.new_site || '',
    time: timeStr,
    remark: site.remark ?? '',
    category: site.category || '',
    hub_type: hubType,
    traffic: trafficLabel,
    priority: trafficLabel,
    site_class: trafficLabel,
    rts: rtsName,
    pic: site.pic || '',
    te: site.pic || '',
    owner: ownerName,
  };

  let formattedLine = (formatConfig.msg_line || '').replace(
    /\{(\w+)\}/g,
    (_, token) => templateContext[token] || ''
  );

  const shouldShowRemark = showRemarkOverride !== undefined ? showRemarkOverride : true;
  const rawRemarkTemplate = String(formatConfig.msg_remark || '');
  if (
    shouldShowRemark &&
    rawRemarkTemplate.trim() &&
    String(site.remark ?? '').trim()
  ) {
    const renderedRemark = rawRemarkTemplate.replace(
      /\{(\w+)\}/g,
      (_, token) => templateContext[token] ?? ''
    );
    const trimmedStart = rawRemarkTemplate.trimStart();
    const isMultilineOverride =
      rawRemarkTemplate.includes('\n') ||
      trimmedStart.startsWith('↳') ||
      rawRemarkTemplate.startsWith('  ');
    formattedLine += isMultilineOverride
      ? `\n${renderedRemark.replace(/^\n+/, '')}`
      : renderedRemark;
  }

  const bcchKeyword = (formatConfig.key_bcch || 'BCCH').toUpperCase();
  const isBcch = (site.remark || '').toUpperCase().includes(bcchKeyword);
  const typeIcon =
    isHub || isCritical
      ? isFully
        ? '⚠️ SITEDOWN'
        : '⚠️ CELLDOWN'
      : isFully
        ? '▶ SITEDOWN'
        : '▶ CELLDOWN';

  return {
    waLine: formattedLine,
    typeRaw,
    typeIcon,
    isFully,
    isBcch,
    time: timeStr,
  };
}

/**
 * Normalizes a processed Pivot row into a site-like outage structure compatible with line formatters.
 */
export function convertPivotRowToSiteItem(pivotRow, statusData = []) {
  let realSiteId = pivotRow.newId || '';
  let realSiteName = pivotRow.siteName || '';

  const siteIdMatch =
    (pivotRow.siteName || '').match(SITE_ID_PATTERN) ||
    (pivotRow.newId || '').match(SITE_ID_PATTERN) ||
    (pivotRow.rowLabels || '').match(SITE_ID_PATTERN);
  if (siteIdMatch) {
    realSiteId = siteIdMatch[1].toUpperCase();
  }

  if (
    realSiteName &&
    realSiteId &&
    realSiteName.toUpperCase().startsWith(`${realSiteId}_`)
  ) {
    realSiteName = realSiteName.substring(realSiteId.length + 1);
  }

  const matchedMaster = Array.isArray(statusData)
    ? statusData.find(
        (statusRow) =>
          statusRow.new_site &&
          statusRow.new_site.toUpperCase() === realSiteId.toUpperCase()
      )
    : null;

  const rtsValue =
    pivotRow.rtsName ||
    matchedMaster?.rts ||
    pivotRow.rts ||
    pivotRow.teName ||
    pivotRow.newTe ||
    '—';
  const picValue = pivotRow.teName || matchedMaster?.pic || pivotRow.newTe || '—';

  const stripMc = (officeText) =>
    officeText && officeText.toUpperCase().startsWith('MC-')
      ? officeText.substring(3).trim()
      : officeText;

  let fmOffice = stripMc(
    pivotRow.fmOffice || matchedMaster?.cluster || pivotRow.cluster || '—'
  );
  if (
    !fmOffice ||
    fmOffice === '—' ||
    fmOffice === '0' ||
    fmOffice.toUpperCase() === rtsValue.toUpperCase() ||
    fmOffice.toUpperCase() === picValue.toUpperCase()
  ) {
    fmOffice = stripMc(matchedMaster?.cluster || pivotRow.cluster || '—');
  }

  const resolvedHubType =
    (!PRIORITY_ONLY_TOKENS.has(String(pivotRow.hubType || '').trim().toUpperCase())
      ? pivotRow.hubType
      : '') ||
    (matchedMaster?.category &&
    !PRIORITY_ONLY_TOKENS.has(matchedMaster.category.toUpperCase())
      ? matchedMaster.category
      : '') ||
    (pivotRow.siteClass && !PRIORITY_ONLY_TOKENS.has(pivotRow.siteClass.toUpperCase())
      ? pivotRow.siteClass
      : '') ||
    'END SITE';

  const resolvedTraffic =
    pivotRow.traffic ||
    pivotRow.priorityLabel ||
    matchedMaster?.traffic ||
    matchedMaster?.priority ||
    (PRIORITY_ONLY_TOKENS.has(String(pivotRow.siteClass || '').trim().toUpperCase())
      ? pivotRow.siteClass
      : '') ||
    '-';

  const isLinkDown = String(pivotRow.monitoring || '').toUpperCase().includes('LINK');
  const resolvedRemark = isLinkDown
    ? extractLinkPairLabel(pivotRow)
    : (pivotRow.remark || pivotRow.duration || pivotRow.aging || '');

  return {
    impact: 'Full Sitedown',
    status: 'DOWN',
    cluster: fmOffice,
    site_name: realSiteName || pivotRow.siteName || realSiteId || '—',
    old_site: '',
    new_site: realSiteId || '—',
    start_time: pivotRow.tanggal || pivotRow.start_time || '—',
    start_timestamp: 0,
    remark: resolvedRemark,
    category: resolvedHubType,
    hub_type: resolvedHubType,
    traffic: resolvedTraffic,
    site_class: resolvedTraffic,
    priority: resolvedTraffic,
    rts: rtsValue,
    pic: picValue,
    vendor: pivotRow.system || 'HUAWEI',
    is_pivot: true,
    is_link_down: isLinkDown,
  };
}

/**
 * Formats a Pivot row (Stollen, Cable Stollen, Enva, Link Down) via one shared parameterized helper.
 */
export function formatPivotSiteLine(
  pivotRow,
  formatConfig,
  { statusData = [], categoryOverride = null, timeFormat = undefined } = {}
) {
  const siteItem = convertPivotRowToSiteItem(pivotRow, statusData);
  if (categoryOverride) {
    siteItem.category = categoryOverride;
    siteItem._categoryOverride = categoryOverride;
  }
  return formatSingleLine(siteItem, formatConfig, false, { timeFormat }).waLine;
}

