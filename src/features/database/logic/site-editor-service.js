import {
  buildSiteDatabaseCopyText,
  getDatabaseFieldValue,
} from '../../../shared/utils/site-data.js';

export const EDITOR_FIELD_DEFS = Object.freeze([
  { key: 'site_id', inputId: 'dbe-site-id-msh', queries: ['Site ID (New)', 'Site ID MSH', 'SITE_ID_MSH', ['SITE', 'ID', 'MSH'], ['SITE', 'ID', 'NEW']] },
  { key: 'lon', inputId: 'dbe-lon', queries: ['Longitude', 'LONGITUDE', ['LONG']] },
  { key: 'site_name', inputId: 'dbe-site-name', queries: ['Site Name', 'SITE_NAME', ['SITE', 'NAME']] },
  { key: 'lat', inputId: 'dbe-lat', queries: ['Latitude', 'LATITUDE', ['LAT']] },
  { key: 'old_site_id', inputId: 'dbe-old-site-id', queries: ['Old Site ID', 'OLD_SITE_ID', ['OLD', 'SITE']] },
  { key: 'tlp', inputId: 'dbe-tlp', queries: ['TLP', ['TLP']] },
  { key: 'cluster', inputId: 'dbe-cluster', queries: ['Cluster (MC)', 'CLUSTER', 'MC', ['CLUSTER'], ['MC']] },
  { key: 'site_class', inputId: 'dbe-site-class', queries: ['Site Class', 'SITE_CLASS', ['SITE', 'CLASS']] },
  { key: 'area', inputId: 'dbe-area', queries: ['Area', 'AREA', ['AREA']] },
  { key: 'hub_type', inputId: 'dbe-hub-type', queries: ['Hub Type', 'HUB_TYPE', ['HUB', 'TYPE']] },
  { key: 'fm_office', inputId: 'dbe-fm-office', queries: ['FM Office', 'FM_OFFICE', ['FM', 'OFFICE']] },
  { key: 'address', inputId: 'dbe-address', queries: ['Address', 'ADDRESS', ['ADDRESS']] },
  { key: 'vendor', inputId: 'dbe-vendor', queries: ['Vendor', 'VENDOR', ['VENDOR']] },
  { key: 'host_name', inputId: 'dbe-host-name', queries: ['Host Name', 'HOST_NAME', ['HOST', 'NAME']] },
  { key: 'rts_name', inputId: 'dbe-rts-name', queries: ['RTS Name', 'RTS_NAME', ['RTS', 'NAME']] },
  { key: 'rts_email', inputId: 'dbe-rts-email', queries: ['RTS Email', 'RTS_EMAIL', ['RTS', 'EMAIL']] },
  { key: 'rts_phone', inputId: 'dbe-rts-phone', queries: ['RTS Phone', 'RTS_PHONE', ['RTS', 'PHONE']] },
  { key: 'rts_new', inputId: 'dbe-rts-new', queries: ['RTS NEW', 'RTS New', 'RTS_NEW', ['RTS', 'NEW']] },
  { key: 'te_name', inputId: 'dbe-te-name', queries: ['TE Name', 'TE_NAME', ['TE', 'NAME']] },
  { key: 'te_phone', inputId: 'dbe-te-phone', queries: ['TE Phone', 'TE_PHONE', ['TE', 'PHONE']] },
  { key: 'te_email', inputId: 'dbe-te-email', queries: ['TE Email', 'TE_EMAIL', ['TE', 'EMAIL']] },
  { key: 'cme_name', inputId: 'dbe-cme-name', queries: ['CME Name', 'CME_NAME', ['CME', 'NAME']] },
  { key: 'cme_phone', inputId: 'dbe-cme-phone', queries: ['CME Phone', 'CME_PHONE', ['CME', 'PHONE']] },
  { key: 'cme_email', inputId: 'dbe-cme-email', queries: ['CME Email', 'CME_EMAIL', ['CME', 'EMAIL']] },
]);

export const LOOKUP_FIELD_DEFS = Object.freeze([
  ['site-id-new', 'Site ID (New)'],
  ['area', 'Area'],
  ['site-name', 'Site Name'],
  ['vendor', 'Vendor'],
  ['old-site-id', 'Old Site ID'],
  ['long', 'Longitude'],
  ['cluster', 'Cluster (MC)'],
  ['lat', 'Latitude'],
  ['host-name', 'Host Name'],
  ['fm-office', 'FM Office'],
  ['tlp', 'TLP'],
  ['rts-name', 'RTS Name'],
  ['rts-new', 'RTS NEW'],
  ['rts-phone', 'RTS Phone'],
  ['te-name', 'TE Name'],
  ['te-phone', 'TE Phone'],
  ['te-email', 'TE Email'],
  ['cme-name', 'CME Name'],
  ['cme-phone', 'CME Phone'],
  ['cme-email', 'CME Email'],
  ['ip-mplane-bts', 'IP Mplane BTS'],
  ['netact-mrbts', 'Netact MRBTS'],
  ['mplane-ip-address', 'Mplane IP Address'],
]);

/**
 * Extracts normalized editor form values from any DB lookup row using exact-first + loose fallback matching.
 */
export function extractSiteEditorFields(row = {}, fallbackSiteId = '') {
  const fields = {};
  for (const def of EDITOR_FIELD_DEFS) {
    let resolved = '';
    for (const query of def.queries) {
      const candidate = getDatabaseFieldValue(row, [query], '');
      if (candidate) {
        resolved = candidate;
        break;
      }
    }
    if (!resolved && def.key === 'site_id') {
      resolved = fallbackSiteId || '';
    }
    fields[def.key] = resolved;
  }
  return fields;
}

/**
 * Normalizes and trims editor form fields into the exact payload expected by `update_site_db`.
 */
export function buildSiteEditPayload(values = {}) {
  const payload = {};
  for (const def of EDITOR_FIELD_DEFS) {
    payload[def.key] = String(values[def.key] || '').trim();
  }
  return payload;
}

/**
 * Extracts all 23 Database Lookup display field strings defaulting to em-dash.
 */
export function extractLookupDisplayFields(row = {}) {
  const display = {};
  for (const [fieldKey, columnName] of LOOKUP_FIELD_DEFS) {
    display[fieldKey] = row[columnName] || '—';
  }
  return display;
}

export { buildSiteDatabaseCopyText };

