import { STORAGE_KEYS } from '../../../shared/state/storage-keys.js';

const SITE_ID_PATTERN = /([0-9]{2}[A-Z]{3}[0-9]{4})/i;

function resolveHeaderIndexList(lines) {
  for (let lineIndex = 0; lineIndex < Math.min(lines.length, 5); lineIndex += 1) {
    const columns = lines[lineIndex].split('\t').map((col) => col.trim().toLowerCase());
    if (
      columns.includes('site_id') ||
      columns.includes('sitecode') ||
      columns.includes('site_name') ||
      columns.includes('alarm_count')
    ) {
      return { headerIndex: lineIndex, headers: columns };
    }
  }

  return {
    headerIndex: 0,
    headers: lines[0].split('\t').map((col) => col.trim().toLowerCase()),
  };
}

/**
 * Parses Netdrone TSV alarms, skips sites already active in the Master Table,
 * and enriches non-skipped rows using an injected `lookupSite` callback.
 */
export async function parseAndEnrichNetdroneData(
  rawText,
  { statusData = [], lookupSite = null } = {}
) {
  if (!rawText || !String(rawText).trim()) return [];
  const lines = String(rawText).trim().split('\n');
  if (lines.length === 0) return [];

  const { headerIndex, headers } = resolveHeaderIndexList(lines);

  function getColumnValue(columns, keywords) {
    for (const keyword of keywords) {
      const idx = headers.indexOf(keyword.toLowerCase());
      if (idx !== -1 && columns[idx] !== undefined) {
        return columns[idx].trim();
      }
    }
    return '';
  }

  const masterSiteIds = new Set();
  (statusData || []).forEach((siteRow) => {
    if (siteRow.new_site) masterSiteIds.add(siteRow.new_site.trim().toUpperCase());
    if (siteRow.old_site) masterSiteIds.add(siteRow.old_site.trim().toUpperCase());
    if (siteRow.site_name) masterSiteIds.add(siteRow.site_name.trim().toUpperCase());
  });

  const parsedRows = [];

  for (let lineIndex = headerIndex + 1; lineIndex < lines.length; lineIndex += 1) {
    const trimmedLine = lines[lineIndex].trim();
    if (!trimmedLine) continue;

    const columns = trimmedLine.split('\t');
    const rawSiteId = getColumnValue(columns, ['site_id', 'sitecode', 'site_name']);
    if (!rawSiteId) continue;

    const siteIdMatch = rawSiteId.match(SITE_ID_PATTERN);
    const siteId = siteIdMatch
      ? siteIdMatch[1].toUpperCase()
      : rawSiteId.split('_')[0].toUpperCase();

    const siteName = getColumnValue(columns, ['site_name', 'sitecode', 'title']) || rawSiteId;
    const vendor = getColumnValue(columns, ['vendor', 'site_vendor']) || '';
    const alarmName = getColumnValue(columns, ['alarm_name', 'title', 'summary']) || 'Full Sitedown';
    const remark = getColumnValue(columns, ['remark', 'remarks', 'wo_remarks', 'summary']) || '';
    const startTime =
      getColumnValue(columns, ['lastoccurrence', 'firstoccurrence', 'last_occurrence']) || '';

    let isMasterPresent = false;
    for (const masterId of masterSiteIds) {
      if (masterId.includes(siteId) || siteId.includes(masterId)) {
        isMasterPresent = true;
        break;
      }
    }

    if (isMasterPresent) {
      parsedRows.push({
        siteId,
        siteName,
        vendor,
        alarmName,
        remark,
        startTime,
        cluster: '',
        pic: '',
        tePhone: '',
        category: '',
        siteClass: '',
        skipped: true,
        matchedDb: false,
        statusMessage: '⚠️ Skipped (Ada di Master)',
      });
      continue;
    }

    let dbRow = null;
    if (typeof lookupSite === 'function') {
      try {
        dbRow = await lookupSite(siteId);
        if (!dbRow && siteName) {
          const cleanName = siteName.split('_')[0].trim();
          if (cleanName && cleanName !== siteId) {
            dbRow = await lookupSite(cleanName);
          }
        }
      } catch (error) {
        console.warn(`Lookup site error for ${siteId}:`, error);
      }
    }

    const hasDbMatch = Boolean(
      dbRow &&
        (dbRow['Site ID (New)'] ||
          dbRow['Old Site ID'] ||
          dbRow['Site Name'] ||
          dbRow['Cluster (MC)'] ||
          dbRow['Cluster'] ||
          dbRow['TE Name'] ||
          dbRow['FE Name'] ||
          dbRow['FME Name'])
    );

    if (hasDbMatch) {
      parsedRows.push({
        siteId,
        siteName,
        vendor: dbRow['Vendor'] || vendor,
        alarmName: 'Full Sitedown',
        remark,
        startTime,
        cluster:
          dbRow['Cluster (MC)'] ||
          dbRow['Cluster'] ||
          dbRow['CLUSTER'] ||
          getColumnValue(columns, ['mc_cluster']) ||
          '',
        pic:
          dbRow['TE Name'] ||
          dbRow['FE Name'] ||
          dbRow['FME Name'] ||
          dbRow['FME'] ||
          dbRow['FE'] ||
          getColumnValue(columns, ['fme_name']) ||
          '',
        rts: dbRow['RTS Name'] || dbRow['RTS'] || getColumnValue(columns, ['rts_name']) || '',
        tePhone:
          dbRow['TE Phone'] ||
          dbRow['FE Phone'] ||
          dbRow['FME Phone'] ||
          getColumnValue(columns, ['fme_phone']) ||
          '',
        category:
          dbRow['Hub Type'] ||
          dbRow['Category'] ||
          dbRow['CATEGORY'] ||
          getColumnValue(columns, ['category']) ||
          '',
        siteClass: dbRow['Site Class'] || dbRow['Tier'] || getColumnValue(columns, ['site_class']) || '',
        skipped: false,
        matchedDb: true,
        statusMessage: '✅ Netdrone (Matched DB)',
      });
    } else {
      parsedRows.push({
        siteId,
        siteName,
        vendor,
        alarmName,
        remark,
        startTime,
        cluster: getColumnValue(columns, ['mc_cluster']) || '',
        pic: getColumnValue(columns, ['fme_name']) || '',
        rts: getColumnValue(columns, ['rts_name']) || '',
        tePhone: getColumnValue(columns, ['fme_phone']) || '',
        category: getColumnValue(columns, ['category']) || '',
        siteClass: getColumnValue(columns, ['site_class']) || '',
        skipped: false,
        matchedDb: false,
        statusMessage: '❓ DB Tidak Ditemukan',
      });
    }
  }

  return parsedRows;
}

export function loadSavedNetdroneDraft(storageAdapter) {
  return {
    rows: storageAdapter.getJson(STORAGE_KEYS.NETDRONE_DATA, []) || [],
    rawText: storageAdapter.getString(STORAGE_KEYS.NETDRONE_RAW_TEXT, ''),
  };
}

export function saveNetdroneDraft(storageAdapter, rows, rawText) {
  storageAdapter.setJson(STORAGE_KEYS.NETDRONE_DATA, rows);
  storageAdapter.setString(STORAGE_KEYS.NETDRONE_RAW_TEXT, rawText);
}

export function clearNetdroneDraft(storageAdapter) {
  storageAdapter.remove(STORAGE_KEYS.NETDRONE_DATA);
  storageAdapter.remove(STORAGE_KEYS.NETDRONE_RAW_TEXT);
}

