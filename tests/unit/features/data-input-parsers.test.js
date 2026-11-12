import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  parsePivotData,
  enrichPivotRows,
} from '../../../src/features/data-input/logic/pivot-parser.js';
import {
  parseAndEnrichNetdroneData,
} from '../../../src/features/data-input/logic/netdrone-parser.js';
import {
  formatMasterProcessFeedback,
  shouldTriggerAutoSnapshot,
} from '../../../src/features/data-input/logic/master-table-service.js';

describe('pivot-parser', () => {
  it('parses Pivot TSV columns dynamically, resolves system inheritance, and skips Grand Total', () => {
    const tsv = [
      'Row Labels\tMonitoring\tSystem\tCluster\tNew ID\tSite Name\tTanggal\tRing\tCategory\tNew TE',
      'Total\t\tERICSSON\t\t\t\t\t\t\t',
      'Row1\tSTOLLEN\t\tMC-Semarang\t14SMG0001\t14SMG0001_Tugu Muda\t2026-11-12 08:00\tR1\tRectifier\tBudi',
      'Grand Total\tGrand Total\t\t\t\t\t\t\t\t',
    ].join('\n');

    const rows = parsePivotData(tsv);
    assert.equal(rows.length, 1);
    assert.deepEqual(rows[0], {
      monitoring: 'STOLLEN',
      system: 'ERICSSON',
      cluster: 'MC-Semarang',
      newId: '14SMG0001',
      siteName: 'Tugu Muda',
      tanggal: '2026-11-12 08:00',
      ring: 'R1',
      remark: '',
      category: 'Rectifier',
      newTe: 'Budi',
    });
  });

  it('retains Ring, Link, and optional Remark columns and separates hubType vs priorityLabel during enrichment', async () => {
    const tsv = [
      'Row Labels\tMonitoring\tSystem\tCluster\tNew ID\tSite Name\tTanggal\tRing\tRemark\tCategory\tNew TE',
      'Row1\tLINK DOWN\tNOKIA\tMC-Batang Timur\t14KND0076\t14KND0076_PATEBON_EP\t2026-11-05 20:39:46\tRING-X | SMG-PTBN-EN1-C516Z - SMG-CPRG-EN1-C506Z\tFO Putus\tMetro\tFreeddy Daryanto',
      'Row2\tPOWER NOW\tHUAWEI\tMC-Kendal\t14KDL0040\t14KDL0040_KLIDANG_WETAN\t2026-11-09 17:15:47\t\t\tPower\tPuji',
    ].join('\n');

    const parsed = parsePivotData(tsv);
    assert.equal(parsed.length, 2);
    assert.equal(parsed[0].ring, 'RING-X | SMG-PTBN-EN1-C516Z - SMG-CPRG-EN1-C506Z');
    assert.equal(parsed[0].remark, 'FO Putus');

    const enriched = await enrichPivotRows(parsed, {
      lookupSite: async (id) =>
        id === '14KND0076'
          ? { 'Hub Type': 'SMALL HUB SITE', 'Site Class': 'VERY HIGH', 'TE Name': 'Freeddy Daryanto' }
          : null,
      statusData: [],
    });

    assert.equal(enriched[0].hubType, 'SMALL HUB SITE');
    assert.equal(enriched[0].traffic, 'VERY HIGH');
    assert.equal(enriched[0].priorityLabel, 'VERY HIGH');
    assert.equal(enriched[1].hubType, 'END SITE');
    assert.equal(enriched[1].traffic, '-');
    assert.equal(enriched[1].priorityLabel, '-');
  });

  it('returns empty array for empty or whitespace input', () => {
    assert.deepEqual(parsePivotData(''), []);
    assert.deepEqual(parsePivotData('   \n  '), []);
  });

  it('enriches pivot rows using DB lookup, strips MC- prefix, and avoids RTS/TE name in FM Office', async () => {
    const rawRows = [
      {
        monitoring: 'ENVA',
        system: 'HUAWEI',
        cluster: 'MC-Klaten',
        newId: '14KLT0002',
        siteName: 'Klaten Kota',
        tanggal: '2026-11-12 09:00',
        category: 'PLN',
        newTe: 'Andi',
      },
    ];

    const enriched = await enrichPivotRows(rawRows, {
      lookupSite: async () => ({
        'RTS Name': 'Rudi RTS',
        'TE Name': 'Andi TE',
        'FM Office': 'MC-Solo',
        'Hub Type': 'MEDIUM HUB SITE',
        'Site Name': 'Klaten Baru',
      }),
      statusData: [],
    });

    assert.equal(enriched[0].cluster, 'Solo');
    assert.equal(enriched[0].fmOffice, 'Solo');
    assert.equal(enriched[0].rtsName, 'Rudi RTS');
    assert.equal(enriched[0].teName, 'Andi TE');
    assert.equal(enriched[0].siteClass, 'MEDIUM HUB SITE');
    assert.equal(enriched[0].siteName, 'Klaten Baru');
  });
});

describe('netdrone-parser', () => {
  it('skips sites already present in master status data and enriches DB matches cleanly', async () => {
    const tsv = [
      'site_id\tsite_name\tvendor\talarm_name\tremark\tlastoccurrence',
      '14SMG0001\tSemarang Satu\tNokia\tS1 Down\tFU Team\t2026-11-12 07:00',
      '14SLG0010\tSalatiga Baru\tHuawei\tCell Down\tPower off\t2026-11-12 08:30',
      '14PWT0099\tPurwokerto Barat\tZTE\tOML Down\tCheck GEN\t2026-11-12 09:00',
    ].join('\n');

    const rows = await parseAndEnrichNetdroneData(tsv, {
      statusData: [{ new_site: '14SMG0001', old_site: '', site_name: 'Semarang Satu' }],
      lookupSite: async (siteId) => {
        if (siteId === '14SLG0010') {
          return {
            'Site ID (New)': '14SLG0010',
            'Cluster (MC)': 'Salatiga',
            'TE Name': 'Sari',
            'TE Phone': '08123456789',
            'Vendor': 'Huawei DB',
          };
        }
        return null;
      },
    });

    assert.equal(rows.length, 3);
    assert.equal(rows[0].skipped, true);
    assert.equal(rows[1].matchedDb, true);
    assert.equal(rows[1].vendor, 'Huawei DB');
    assert.equal(rows[1].alarmName, 'Full Sitedown');
    assert.equal(rows[1].cluster, 'Salatiga');
    assert.equal(rows[2].matchedDb, false);
    assert.equal(rows[2].siteId, '14PWT0099');
  });

  it('returns empty array on empty netdrone input', async () => {
    assert.deepEqual(await parseAndEnrichNetdroneData(''), []);
  });
});

describe('master-table-service', () => {
  it('formats status feedback messages across all backend statuses and checks hourly snapshot window', () => {
    assert.match(formatMasterProcessFeedback({ status: 'NEW_BASELINE', count: 12 }, '10:00:00').snapshotText, /12/);
    assert.match(formatMasterProcessFeedback({ status: 'UNCHANGED', count: 5 }, '10:00:00').statusText, /snapshot dipertahankan/);
    assert.match(formatMasterProcessFeedback({ status: 'EMPTY', count: 0 }, '10:00:00').statusText, /empty or format/);

    assert.equal(shouldTriggerAutoSnapshot({ hour: 10, minute: 1, lastSnapshotHour: 9, masterCount: 5 }), true);
    assert.equal(shouldTriggerAutoSnapshot({ hour: 10, minute: 1, lastSnapshotHour: 10, masterCount: 5 }), false);
    assert.equal(shouldTriggerAutoSnapshot({ hour: 10, minute: 3, lastSnapshotHour: 9, masterCount: 5 }), false);
    assert.equal(shouldTriggerAutoSnapshot({ hour: 10, minute: 1, lastSnapshotHour: 9, masterCount: 0 }), false);
  });
});

