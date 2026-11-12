import { STORAGE_KEYS } from '../../../shared/state/storage-keys.js';

const SITE_ID_PATTERN = /([0-9]{2}[A-Z]{3}[0-9]{4})/i;

const PRIORITY_ONLY_TOKENS = new Set([
  'A',
  'B',
  'C',
  'HIGH',
  'VERY HIGH',
  'LOW',
  'STANDARD',
  'REGULAR',
  'CRITICAL',
]);

function isPriorityOnlyValue(value) {
  const normalized = String(value ?? '').trim().toUpperCase();
  if (!normalized || normalized.length <= 2) return true;
  if (PRIORITY_ONLY_TOKENS.has(normalized)) return true;
  return normalized.includes('CRITICAL') && !normalized.includes('HUB') && !normalized.includes('END SITE');
}

function pickFirstNonEmpty(candidates, predicate = (val) => Boolean(val)) {
  for (const candidate of candidates) {
    const trimmed = String(candidate ?? '').trim();
    if (trimmed && predicate(trimmed)) {
      return trimmed;
    }
  }
  return '';
}

/**
 * Parses pasted Excel Pivot TSV text into normalized pivot rows without DOM side effects.
 */
export function parsePivotData(rawText) {
  if (!rawText || !String(rawText).trim()) return [];
  const lines = String(rawText).trim().split('\n');
  const rows = [];
  let currentSystem = '';

  const columnIndices = {
    rowLabels: 0,
    monitoring: 1,
    system: 2,
    cluster: 3,
    newId: 4,
    siteName: 5,
    tanggal: 6,
    ring: 7,
    category: 8,
    newTe: 9,
    link: undefined,
    remark: undefined,
  };

  let headerFound = false;

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const trimmedLine = lines[lineIndex].trim();
    if (!trimmedLine) continue;

    const parts = trimmedLine.split('\t').map((part) => part.trim());

    if (parts[0] === 'Row Labels' || parts.includes('Monitoring')) {
      parts.forEach((part, colIndex) => {
        const headerLower = part.toLowerCase();
        if (headerLower.includes('label')) columnIndices.rowLabels = colIndex;
        else if (headerLower.includes('monitoring')) columnIndices.monitoring = colIndex;
        else if (headerLower.includes('system')) columnIndices.system = colIndex;
        else if (headerLower.includes('cluster')) columnIndices.cluster = colIndex;
        else if (headerLower.includes('new id') || headerLower.includes('new site id') || headerLower === 'id') {
          columnIndices.newId = colIndex;
        } else if (headerLower.includes('site name') || headerLower.includes('name')) {
          columnIndices.siteName = colIndex;
        } else if (headerLower.includes('tanggal') || headerLower.includes('date') || headerLower.includes('start')) {
          columnIndices.tanggal = colIndex;
        } else if (headerLower.includes('ring')) columnIndices.ring = colIndex;
        else if (headerLower.includes('link')) columnIndices.link = colIndex;
        else if (headerLower.includes('remark') || headerLower === 'rem') columnIndices.remark = colIndex;
        else if (headerLower.includes('category') || headerLower.includes('categ')) columnIndices.category = colIndex;
        else if (headerLower.includes('new te') || headerLower.includes('te name') || headerLower === 'te') {
          columnIndices.newTe = colIndex;
        }
      });
      headerFound = true;
      continue;
    }

    if (!headerFound && lineIndex === 0) {
      headerFound = true;
    }

    if (parts.length < 2) continue;

    const rawId = parts[columnIndices.newId] || '';
    const rowLabel = parts[columnIndices.rowLabels] || '';
    const siteName = parts[columnIndices.siteName] || '';
    const monitoring = parts[columnIndices.monitoring] || '';
    const systemValue = parts[columnIndices.system] || '';

    if (monitoring.toUpperCase() === 'GRAND TOTAL' || rowLabel.toUpperCase() === 'GRAND TOTAL') {
      continue;
    }

    const siteIdMatch =
      trimmedLine.match(SITE_ID_PATTERN) ||
      rawId.match(SITE_ID_PATTERN) ||
      siteName.match(SITE_ID_PATTERN) ||
      rowLabel.match(SITE_ID_PATTERN);
    const newId = siteIdMatch ? siteIdMatch[1].toUpperCase() : '';

    if (!newId) {
      if (systemValue && systemValue !== '0' && Number.isNaN(Number(systemValue))) {
        currentSystem = systemValue.toUpperCase();
      }
      continue;
    }

    let cleanedSiteName = siteName;
    if (cleanedSiteName && newId && cleanedSiteName.toUpperCase().startsWith(`${newId}_`)) {
      cleanedSiteName = cleanedSiteName.substring(newId.length + 1);
    }

    const ringValue = parts[columnIndices.ring] || '';
    const linkValue = columnIndices.link !== undefined ? parts[columnIndices.link] || '' : '';
    const remarkValue = columnIndices.remark !== undefined ? parts[columnIndices.remark] || '' : '';

    rows.push({
      monitoring: monitoring.toUpperCase(),
      system: currentSystem || systemValue.toUpperCase() || 'HUAWEI',
      cluster: parts[columnIndices.cluster] || '',
      newId,
      siteName: cleanedSiteName || siteName || newId,
      tanggal: parts[columnIndices.tanggal] || '',
      ring: ringValue || linkValue,
      ...(linkValue ? { link: linkValue } : {}),
      remark: remarkValue,
      category: parts[columnIndices.category] || '',
      newTe: parts[columnIndices.newTe] || '',
    });
  }

  return rows;
}

function stripMcPrefix(officeText) {
  if (!officeText) return officeText;
  return officeText.toUpperCase().startsWith('MC-')
    ? officeText.substring(3).trim()
    : officeText;
}

/**
 * Enriches parsed pivot rows with RTS/TE ownership, cleaned FM Office cluster,
 * site class, and canonical site name via injected DB lookup and master status list.
 */
export async function enrichPivotRows(rawRows, { lookupSite = null, statusData = [] } = {}) {
  const enrichedRows = [];

  for (const row of rawRows) {
    let dbInfo = null;
    if (typeof lookupSite === 'function' && row.newId) {
      try {
        dbInfo = await lookupSite(row.newId);
      } catch (error) {
        console.error('DB lookup failed for', row.newId, error);
      }
    }

    const matchedMaster = Array.isArray(statusData)
      ? statusData.find(
          (statusRow) =>
            statusRow.new_site &&
            statusRow.new_site.toUpperCase() === (row.newId || '').toUpperCase()
        )
      : null;

    const rtsName =
      (dbInfo && (dbInfo['RTS Name'] || dbInfo['TE Name'])) ||
      (matchedMaster && (matchedMaster.rts || matchedMaster.pic)) ||
      row.newTe ||
      '—';
    const teName =
      (dbInfo && dbInfo['TE Name']) ||
      (matchedMaster && matchedMaster.pic) ||
      row.newTe ||
      '—';

    let fmOffice = stripMcPrefix(
      (dbInfo && dbInfo['FM Office']) ||
      (matchedMaster && matchedMaster.cluster) ||
      row.cluster ||
      '—'
    );

    if (
      !fmOffice ||
      fmOffice === '—' ||
      fmOffice === '0' ||
      fmOffice.toUpperCase() === rtsName.toUpperCase() ||
      fmOffice.toUpperCase() === teName.toUpperCase()
    ) {
      fmOffice = stripMcPrefix(
        (dbInfo && dbInfo['Cluster (MC)']) ||
        (matchedMaster && matchedMaster.cluster) ||
        row.cluster ||
        '—'
      );
    }

    const hubType =
      pickFirstNonEmpty(
        [
          dbInfo && dbInfo['Hub Type'],
          matchedMaster && matchedMaster.hub_type,
          matchedMaster && matchedMaster.category,
          row.hubType,
          row.siteClass,
        ],
        (val) => !isPriorityOnlyValue(val)
      ) || 'END SITE';

    const trafficTier =
      pickFirstNonEmpty([
        matchedMaster && matchedMaster.traffic,
        dbInfo && dbInfo['Traffic'],
        dbInfo && dbInfo['Site Priority Label'],
        dbInfo && dbInfo['Site Class'],
        dbInfo && dbInfo['Tier'],
        dbInfo && dbInfo['Priority'],
        matchedMaster && matchedMaster.priority,
        matchedMaster && matchedMaster.site_class,
        row.traffic,
        row.priorityLabel,
      ]) || '-';

    let resolvedSiteName = row.siteName;
    if (dbInfo && dbInfo['Site Name']) {
      resolvedSiteName = dbInfo['Site Name'];
    } else if (matchedMaster && matchedMaster.site_name) {
      resolvedSiteName = matchedMaster.site_name;
    }

    enrichedRows.push({
      ...row,
      rtsName,
      teName,
      fmOffice,
      cluster: fmOffice,
      hubType,
      traffic: trafficTier,
      priorityLabel: trafficTier,
      siteClass: hubType,
      siteName: resolvedSiteName,
    });
  }

  return enrichedRows;
}

export function loadSavedPivotDraft(storageAdapter) {
  return {
    rows: storageAdapter.getJson(STORAGE_KEYS.PIVOT_DATA, []) || [],
    rawText: storageAdapter.getString(STORAGE_KEYS.PIVOT_RAW_TEXT, ''),
  };
}

export function savePivotDraft(storageAdapter, rows, rawText) {
  storageAdapter.setJson(STORAGE_KEYS.PIVOT_DATA, rows);
  storageAdapter.setString(STORAGE_KEYS.PIVOT_RAW_TEXT, rawText);
}

export function clearPivotDraft(storageAdapter) {
  storageAdapter.remove(STORAGE_KEYS.PIVOT_DATA);
  storageAdapter.remove(STORAGE_KEYS.PIVOT_RAW_TEXT);
}

