import { detectRegion } from '../../../shared/utils/region-detector.js';

function cleanHeaderToken(rawHeader) {
  return String(rawHeader || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Checks whether an outage remark represents active field team dispatch
 * (Team OTW/ETA, Team Onsite, BUG, or TS).
 */
export function isFlashReportRemarkMatch(remark) {
  if (!remark) return false;
  const remarkLower = String(remark).toLowerCase();

  const hasOtwOrEta = remarkLower.includes('otw') || remarkLower.includes('eta');
  const hasOnsite = remarkLower.includes('onsite');
  const hasBug = remarkLower.includes('bug');
  const hasTs =
    /\bts\b/i.test(remarkLower) ||
    remarkLower.includes('onsite ts') ||
    remarkLower.includes('team ts');

  return hasOtwOrEta || hasOnsite || hasBug || hasTs;
}

/**
 * Parses pasted Flash Master TSV data into structured site rows with technology tags,
 * canonical region classification, and remark activity matching.
 */
export function parseFlashMasterTSV(rawText) {
  if (!rawText || !String(rawText).trim()) return [];
  const lines = String(rawText).trim().split(/\r?\n/);
  if (lines.length < 2) return [];

  const rawHeaders = lines[0].split('\t').map((header) => header.trim());
  const cleanedHeaders = rawHeaders.map(cleanHeaderToken);

  function findColumnIndex(targetKeys, excludedIndices = []) {
    for (const key of targetKeys) {
      const cleanedTarget = cleanHeaderToken(key);
      const exactIndex = cleanedHeaders.findIndex(
        (header, idx) => !excludedIndices.includes(idx) && header === cleanedTarget
      );
      if (exactIndex !== -1) return exactIndex;
    }

    for (const key of targetKeys) {
      const cleanedTarget = cleanHeaderToken(key);
      const partialIndex = cleanedHeaders.findIndex(
        (header, idx) =>
          !excludedIndices.includes(idx) &&
          (header.includes(cleanedTarget) || cleanedTarget.includes(header))
      );
      if (partialIndex !== -1) return partialIndex;
    }

    return -1;
  }

  const assignedIndices = [];
  function trackColumn(targetKeys) {
    const idx = findColumnIndex(targetKeys, assignedIndices);
    if (idx !== -1) assignedIndices.push(idx);
    return idx;
  }

  let colSiteId = trackColumn(['newsite', 'siteid', 'sitecode', 'new_site', 'site_id', 'site id']);
  let colMc = trackColumn(['mccluster', 'mc_cluster', 'mc-cluster', 'clustermc', 'mc']);
  let colSiteName = trackColumn(['sitename', 'site_name', 'site name']);
  const colCluster = trackColumn(['fmoffice', 'cluster', 'fm_office', 'locationname', 'fmo']);
  const colRoh = trackColumn(['roh', 'region', 'area', 'areaname', 'fiveregion']);
  const colRemark = trackColumn(['remark', 'remarks', 'woremarks', 'rcacategory', 'summary']);
  const colImpact = trackColumn(['impactsite', 'impact', 'severity', 'alarmname']);
  const colNetType = trackColumn(['networktype', 'nettype', 'devicetype', 'ratinfo', 'technology']);

  const sampleParts = lines[1].split('\t');
  if (colSiteId === -1) {
    const fallbackIdx = sampleParts.findIndex((cell) =>
      /^[0-9]{2}[A-Za-z]{3}[0-9]{4}/.test(cell.trim())
    );
    colSiteId = fallbackIdx !== -1 ? fallbackIdx : 1;
  }
  if (colMc === -1) {
    const fallbackIdx = sampleParts.findIndex((cell) => /^MC-/i.test(cell.trim()));
    if (fallbackIdx !== -1) colMc = fallbackIdx;
  }
  if (colSiteName === -1) {
    colSiteName = colSiteId !== -1 && sampleParts.length > colSiteId + 1 ? colSiteId + 1 : 5;
  }

  const parsedRows = [];
  for (let rowIndex = 1; rowIndex < lines.length; rowIndex += 1) {
    const parts = lines[rowIndex].split('\t');
    if (parts.length < 2) continue;

    const siteId = (colSiteId !== -1 && parts[colSiteId] ? parts[colSiteId] : '').trim();
    if (!siteId) continue;

    const siteName = (colSiteName !== -1 && parts[colSiteName] ? parts[colSiteName] : siteId).trim();
    const mcCluster = (colMc !== -1 && parts[colMc] ? parts[colMc] : '').trim();
    const cluster = (colCluster !== -1 && parts[colCluster] ? parts[colCluster] : '').trim();
    const netRaw = (colNetType !== -1 && parts[colNetType] ? parts[colNetType] : '').trim().toUpperCase();
    const remark = (colRemark !== -1 && parts[colRemark] ? parts[colRemark] : '').trim();
    const impact = (colImpact !== -1 && parts[colImpact] ? parts[colImpact] : '').trim();
    const rawRoh = (colRoh !== -1 && parts[colRoh] ? parts[colRoh] : '').trim();

    let is2G =
      netRaw.includes('2G') ||
      netRaw.includes('BTS') ||
      netRaw.includes('GSM') ||
      impact.toUpperCase().includes('2G');
    let is4G =
      netRaw.includes('4G') ||
      netRaw.includes('ENODEB') ||
      netRaw.includes('LTE') ||
      impact.toUpperCase().includes('4G');

    if (!is2G && !is4G) {
      is4G = true;
    }

    const netLabel = is2G && is4G ? '2G/4G' : is2G ? '2G' : '4G';
    const region = detectRegion({
      siteId,
      cluster,
      siteName,
      remark,
      rawRegion: rawRoh,
    });

    const matchesFilter = isFlashReportRemarkMatch(remark);
    const impactLower = impact.toLowerCase();
    const isCell = impactLower.includes('cell');
    const isFully =
      impactLower.includes('fully') ||
      impactLower.includes('sitedown') ||
      (!isCell && (impactLower.includes('down') || !impact));

    parsedRows.push({
      siteId,
      siteName,
      mcCluster,
      cluster,
      netLabel,
      is2G,
      is4G,
      impact: impact || (isFully ? 'Fully Down' : 'Cell Down'),
      isFully,
      remark,
      region,
      matchesFilter,
    });
  }

  return parsedRows;
}

/**
 * Converts active Master status entries into Flash Master rows cleanly.
 */
export function mapStatusRowsToFlashMasterRows(statusData = []) {
  return (statusData || []).map((siteRow) => {
    const impactText = siteRow.impact || siteRow.status || '';
    const impactLower = impactText.toLowerCase();
    const isCell = impactLower.includes('cell');
    const isFully = Boolean(
      siteRow.is_netdrone ||
        impactLower.includes('fully') ||
        impactLower.includes('sitedown') ||
        (!isCell && (siteRow.status === 'DOWN' || impactLower.includes('down')))
    );
    const is2G = Boolean(siteRow.category && siteRow.category.includes('2G'));

    return {
      siteId: siteRow.new_site || siteRow.site_id || '',
      siteName: siteRow.site_name || '',
      mcCluster: siteRow.cluster || '',
      cluster: siteRow.cluster || '',
      fmOffice: siteRow.cluster || '',
      hubType: siteRow.category || siteRow.hub_type || 'SMALL HUB SITE',
      netLabel: is2G ? '2G' : '4G',
      is2G,
      is4G: !is2G,
      impact: impactText,
      isFully,
      remark: siteRow.remark || '',
      region: detectRegion(siteRow),
      matchesFilter: isFlashReportRemarkMatch(siteRow.remark),
    };
  });
}

/**
 * Enriches matched Flash Master rows in place via an injected async DB lookup.
 */
export async function enrichFlashMasterRows(rows, lookupSite) {
  if (typeof lookupSite !== 'function' || !Array.isArray(rows)) return false;

  let hasUpdates = false;
  for (const row of rows) {
    if (row.matchesFilter && (!row.hubType || !row.fmOffice)) {
      try {
        const dbData = await lookupSite(row.siteId);
        if (dbData) {
          if (!row.hubType) row.hubType = dbData['Hub Type'] || dbData['Site Class'] || 'SMALL HUB SITE';
          if (!row.fmOffice) row.fmOffice = dbData['FM Office'] || dbData['Cluster (MC)'] || row.cluster;
          if (dbData['Site Name'] && (!row.siteName || row.siteName === row.siteId)) {
            row.siteName = dbData['Site Name'];
          }
          hasUpdates = true;
        }
      } catch (error) {
        console.warn('Flash row DB lookup failed:', error);
      }
    }
  }

  return hasUpdates;
}

