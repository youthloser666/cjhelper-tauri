const SITE_ID_PATTERN = /([0-9]{2}[A-Z]{3}[0-9]{4})/i;

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
export function formatSingleLine(site, formatConfig, showRemarkOverride) {
  const impactLower = (site.impact || '').toLowerCase();
  const isFully = Boolean(
    site.is_netdrone || impactLower.includes('fully') || impactLower.includes('sitedown')
  );
  const typeRaw = isFully ? 'SITE DOWN' : 'CELLS DOWN';

  const combinedMeta = `${site.category || ''} ${site.impact || ''}`
    .toUpperCase()
    .replace(/[-_\s]+/g, ' ');
  const isHub =
    combinedMeta.includes('HUB') &&
    (combinedMeta.includes('MEDIUM') || combinedMeta.includes('BIG'));
  const isCritical = (site.site_class || '').toUpperCase().includes('CRITICAL');

  const iconChar = isHub || isCritical ? '⚠️ ' : `${formatConfig.icon_down || '▶️'} `;
  const timeStr = formatUtcTimestampDisplay(site.start_timestamp, site.start_time || '');

  const templateContext = {
    icon: iconChar.trim(),
    type: typeRaw,
    cluster: site.cluster || '',
    sitename: site.site_name || '',
    old: site.old_site || '',
    new: site.new_site || '',
    time: timeStr,
    remark: site.remark || '',
    category: site.category || '',
    rts: site.rts || '',
    pic: site.pic || '',
    te: site.pic || '',
  };

  let formattedLine = (formatConfig.msg_line || '').replace(
    /\{(\w+)\}/g,
    (_, token) => templateContext[token] || ''
  );

  const shouldShowRemark = showRemarkOverride !== undefined ? showRemarkOverride : true;
  if (
    shouldShowRemark &&
    (formatConfig.msg_remark || '').trim() &&
    (site.remark || '').trim()
  ) {
    formattedLine +=
      '\n' +
      formatConfig.msg_remark.replace(
        /\{(\w+)\}/g,
        (_, token) => templateContext[token] || ''
      );
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

  let resolvedClass =
    (matchedMaster?.site_class &&
    !matchedMaster.site_class.toUpperCase().includes('CRITICAL')
      ? matchedMaster.site_class
      : '') ||
    (pivotRow.siteClass && !pivotRow.siteClass.toUpperCase().includes('CRITICAL')
      ? pivotRow.siteClass
      : '') ||
    (matchedMaster?.category &&
    !matchedMaster.category.toUpperCase().includes('CRITICAL')
      ? matchedMaster.category
      : '') ||
    '';

  if (
    !resolvedClass ||
    resolvedClass === 'A' ||
    resolvedClass === 'B' ||
    resolvedClass === 'C' ||
    resolvedClass.length <= 2 ||
    resolvedClass.toUpperCase().includes('CRITICAL')
  ) {
    resolvedClass = 'END SITE';
  }

  return {
    impact: 'Full Sitedown',
    status: 'DOWN',
    cluster: fmOffice,
    site_name: realSiteName || pivotRow.siteName || realSiteId || '—',
    old_site: '',
    new_site: realSiteId || '—',
    start_time: pivotRow.tanggal || pivotRow.start_time || '—',
    start_timestamp: 0,
    remark: pivotRow.remark || pivotRow.duration || pivotRow.aging || pivotRow.monitoring || '',
    category: resolvedClass,
    site_class: resolvedClass,
    rts: rtsValue,
    pic: picValue,
    vendor: pivotRow.system || 'HUAWEI',
    is_pivot: true,
  };
}

/**
 * Formats a Pivot row (Stollen, Cable Stollen, Enva) via one shared parameterized helper.
 */
export function formatPivotSiteLine(
  pivotRow,
  formatConfig,
  { statusData = [], categoryOverride = null } = {}
) {
  const siteItem = convertPivotRowToSiteItem(pivotRow, statusData);
  if (categoryOverride) {
    siteItem.category = categoryOverride;
  }
  return formatSingleLine(siteItem, formatConfig, false).waLine;
}

