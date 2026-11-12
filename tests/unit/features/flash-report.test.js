import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  isFlashReportRemarkMatch,
  parseFlashMasterTSV,
  mapStatusRowsToFlashMasterRows,
} from '../../../src/features/flash-report/logic/flash-master-parser.js';
import {
  filterFlashRows,
  computeFlashStats,
} from '../../../src/features/flash-report/logic/flash-filter.js';
import {
  buildFlashReportText,
  computeDefaultFlashReportTime,
} from '../../../src/features/flash-report/logic/flash-report-builder.js';

describe('flash-master-parser', () => {
  it('matches field activity remarks for OTW/ETA, Onsite, BUG, and TS while rejecting unrelated remarks', () => {
    assert.equal(isFlashReportRemarkMatch('Team OTW ETA 30 menit'), true);
    assert.equal(isFlashReportRemarkMatch('Team onsite TS checking PLN'), true);
    assert.equal(isFlashReportRemarkMatch('Team onsite BUG backup genset'), true);
    assert.equal(isFlashReportRemarkMatch('Follow up team by phone'), false);
    assert.equal(isFlashReportRemarkMatch(''), false);
  });

  it('parses Flash Master TSV columns into 2G/4G/2G/4G netLabels, region, and isFully flags', () => {
    const tsv = [
      'New Site\tMC Cluster\tSite Name\tFM Office\tROH\tRemark\tImpact Site\tNetwork Type',
      '14SMG0001\tMC-Semarang\tTugu Muda\tSemarang\tCJN\tTeam OTW ETA\tFully Down\t2G/4G',
      '14SLO0002\tMC-Solo\tSolo Baru\tSolo\tCJS\tPower issue\tCell Down\t4G LTE',
      '14PWT0003\tMC-Purwokerto\tBanyumas\tPurwokerto\tCJS\tTeam Onsite BUG\tFully Down\t2G GSM',
    ].join('\n');

    const rows = parseFlashMasterTSV(tsv);
    assert.equal(rows.length, 3);
    assert.equal(rows[0].netLabel, '2G/4G');
    assert.equal(rows[0].region, 'CJN');
    assert.equal(rows[0].matchesFilter, true);
    assert.equal(rows[0].isFully, true);

    assert.equal(rows[1].netLabel, '4G');
    assert.equal(rows[1].region, 'CJS');
    assert.equal(rows[1].isFully, false);
    assert.equal(rows[1].matchesFilter, false);

    assert.equal(rows[2].netLabel, '2G');
    assert.equal(rows[2].region, 'CJS');
    assert.equal(rows[2].matchesFilter, true);
  });

  it('maps Master status rows cleanly into Flash Master structures', () => {
    const mapped = mapStatusRowsToFlashMasterRows([
      {
        new_site: '14KLT0010',
        site_name: 'Klaten Utara',
        cluster: 'Klaten',
        category: '2G GSM',
        impact: 'Cell Down',
        status: 'DOWN',
        remark: 'Team onsite TS',
      },
    ]);

    assert.equal(mapped.length, 1);
    assert.equal(mapped[0].region, 'CJS');
    assert.equal(mapped[0].netLabel, '2G');
    assert.equal(mapped[0].isFully, false);
    assert.equal(mapped[0].matchesFilter, true);
  });
});

describe('flash-filter', () => {
  const sampleRows = [
    { siteId: '14SMG0001', mcCluster: 'MC-SMG', region: 'CJN', isFully: true, matchesFilter: true },
    { siteId: '14SLO0002', mcCluster: 'MC-SLO', region: 'CJS', isFully: false, matchesFilter: false },
    { siteId: '14SLO0003', mcCluster: 'MC-SLO', region: 'CJS', isFully: true, matchesFilter: true },
  ];

  it('filters by impact mode and region and computes MC/matched stats including manual entries', () => {
    const filteredCjsFully = filterFlashRows(sampleRows, { region: 'CJS', impact: 'FULLY' });
    assert.equal(filteredCjsFully.length, 1);
    assert.equal(filteredCjsFully[0].siteId, '14SLO0003');

    const stats = computeFlashStats(filteredCjsFully, [{ siteId: '14KLT0099' }]);
    assert.equal(stats.totalRows, 1);
    assert.equal(stats.mcCount, 1);
    assert.equal(stats.siteDown2g, 1);
    assert.equal(stats.siteDown4g, 1);
    assert.equal(stats.matchedTotal, 2);
  });
});

describe('flash-report-builder', () => {
  it('formats complete WhatsApp Flash Report output with MC delimiters, DG status, and Position PG lines', () => {
    const output = buildFlashReportText({
      filteredRows: [
        {
          siteId: '14SMG0001',
          siteName: 'Tugu Muda',
          mcCluster: 'MC-Semarang',
          fmOffice: 'Semarang',
          hubType: 'SMALL HUB SITE',
          remark: 'Team OTW ETA',
          matchesFilter: true,
        },
        {
          siteId: '14KDS0002',
          siteName: 'Kudus Kota',
          mcCluster: 'MC-Kudus',
          fmOffice: 'Kudus',
          remark: 'PLN Off',
          matchesFilter: false,
        },
      ],
      manualEntries: [
        {
          fmOffice: 'Solo',
          siteId: '14SLO0088',
          siteName: '14SLO0088_Solo Square',
          hubType: 'MEDIUM HUB SITE',
          remark: 'Onsite backup PG',
        },
      ],
      timeStr: '21:00',
      titleRegion: 'Central Java',
      mcFormat: 'comma',
      count2g: 5,
      count4g: 7,
      dgRunning: 2,
      dgTotal: 4,
      teamMove: '1102 Cluster',
      pgCompleted: '3',
      pgInstalled: '2',
      pgMovement: '1',
      referenceDate: new Date(2026, 9, 30, 20, 45, 0),
    });

    assert.match(output, /\*Template flash report: Central Java 30-Oct-2026 21:00\*/);
    assert.match(output, /\*MC impact:  2 MC\*/);
    assert.match(output, /MC-Semarang, MC-Kudus,/);
    assert.match(output, /🔹 \*2G : 5\*/);
    assert.match(output, /🔹 \*4G : 7\*/);
    assert.match(output, /🔹 2 of 4 Running\*/);
    assert.match(output, /Team Move : 1102 Cluster \| PG Completed : 3 \| PG Installed : 2 \| PG Movement : 1/);
    assert.match(output, /- Semarang \/ 14SMG0001_Tugu Muda \/ SMALL HUB SITE \| Team OTW ETA/);
    assert.match(output, /- Solo \/ 14SLO0088_Solo Square \/ MEDIUM HUB SITE \| Onsite backup PG/);
  });

  it('rounds half-past times up to the next hour for default report time', () => {
    assert.equal(computeDefaultFlashReportTime(new Date(2026, 10, 12, 20, 35, 0)), '21:00');
    assert.equal(computeDefaultFlashReportTime(new Date(2026, 10, 12, 20, 15, 0)), '20:00');
  });
});

