import test from 'node:test';
import assert from 'node:assert/strict';

import { STORAGE_KEYS } from '../../../src/shared/state/storage-keys.js';
import {
  DEFAULT_MSG_FORMAT,
  DEFAULT_BC_FORMAT,
} from '../../../src/features/messages/logic/format-config.js';
import {
  DEFAULT_BLAST_FILTER_CONFIG,
  loadBlastFilterConfig,
  saveBlastFilterConfig,
  shouldSendToTe,
  getBlastSiteKey,
  isBlastSiteSelected,
  classifyDownSitesForBlast,
  getBlastFilterCounts,
} from '../../../src/features/whatsapp-broadcast/logic/blast-filter.js';
import {
  buildTeGroups,
  getTeMessageItemCount,
  generateTeMessage,
  generateShareBroadcastMessage,
} from '../../../src/features/whatsapp-broadcast/logic/te-message-generator.js';
import {
  loadBroadcastLogs,
  appendBroadcastLog,
  formatBroadcastLogsDisplay,
} from '../../../src/features/whatsapp-broadcast/logic/broadcast-log-service.js';
import {
  resolveSessionPollInterval,
  getWaSessionPresentation,
  buildQrCodeImageUrl,
} from '../../../src/features/whatsapp-broadcast/logic/wa-session-service.js';

function createMemoryStorage(initial = {}) {
  const store = new Map(Object.entries(initial));
  return {
    getJson(key, fallback = null) {
      if (!store.has(key)) return fallback;
      return JSON.parse(store.get(key));
    },
    setJson(key, value) {
      store.set(key, JSON.stringify(value));
    },
  };
}

test('T027 blast filter defaults and storage persistence match specification', () => {
  assert.deepEqual(DEFAULT_BLAST_FILTER_CONFIG, {
    filterRemarkTrigger: true,
    enableSitedown: true,
    enableCelldown: true,
    enableBcch: true,
    enableEnva: false,
    enableStolen: false,
    enableNetdrone: true,
  });

  const storage = createMemoryStorage();
  assert.deepEqual(loadBlastFilterConfig(storage), DEFAULT_BLAST_FILTER_CONFIG);

  const updated = { ...DEFAULT_BLAST_FILTER_CONFIG, enableEnva: true, filterRemarkTrigger: false };
  saveBlastFilterConfig(storage, updated);
  assert.deepEqual(storage.getJson(STORAGE_KEYS.BLAST_FILTER_CONFIG), updated);
  assert.deepEqual(loadBlastFilterConfig(storage), updated);
});

test('T027 shouldSendToTe evaluates remark trigger keywords case-insensitively and exact-match', () => {
  const strictCfg = { ...DEFAULT_BLAST_FILTER_CONFIG, filterRemarkTrigger: true };
  assert.equal(shouldSendToTe('', strictCfg), true);
  assert.equal(shouldSendToTe('   ', strictCfg), true);
  assert.equal(shouldSendToTe('FU Team', strictCfg), true);
  assert.equal(shouldSendToTe('follow up team', strictCfg), true);
  assert.equal(shouldSendToTe('PLAN TS TODAY', strictCfg), true);
  assert.equal(shouldSendToTe('Waiting PLN', strictCfg), false);
  assert.equal(shouldSendToTe('FU Team besok', strictCfg), false);

  const openCfg = { ...strictCfg, filterRemarkTrigger: false };
  assert.equal(shouldSendToTe('Waiting PLN', openCfg), true);
});

test('T027 blast site classification, selection overrides, and counts compute accurately', () => {
  const sites = [
    { status: 'DOWN', impact: 'Fully Down', new_site: '21SMG0001', site_name: 'Alpha', cluster: 'Semarang', remark: 'FU Team' },
    { status: 'DOWN', impact: 'Partial Cell Down', new_site: '21SMG0002', site_name: 'Beta', cluster: 'Semarang', remark: 'BCCH missing' },
    { status: 'DOWN', impact: 'Partial Cell Down', new_site: '21SMG0003', site_name: 'Gamma', cluster: 'Kudus', remark: 'Waiting PLN' },
    { status: 'UP', impact: 'Partial Cell Down', new_site: '21SMG0004', site_name: 'Delta', cluster: 'Kudus', remark: '' },
    { status: 'DOWN', impact: 'Full Sitedown', new_site: '21SMG0005', site_name: 'Epsilon', cluster: 'Semarang', remark: 'Waiting PLN', is_netdrone: true },
  ];

  const keyBeta = getBlastSiteKey(sites[1], DEFAULT_MSG_FORMAT);
  assert.equal(keyBeta, '21SMG0002_BCCH');

  const selectionMap = { [keyBeta]: false };
  assert.equal(isBlastSiteSelected(sites[0], selectionMap, DEFAULT_BLAST_FILTER_CONFIG, DEFAULT_MSG_FORMAT), true);
  assert.equal(isBlastSiteSelected(sites[1], selectionMap, DEFAULT_BLAST_FILTER_CONFIG, DEFAULT_MSG_FORMAT), false);
  assert.equal(isBlastSiteSelected(sites[2], selectionMap, DEFAULT_BLAST_FILTER_CONFIG, DEFAULT_MSG_FORMAT), false);
  assert.equal(isBlastSiteSelected(sites[4], selectionMap, DEFAULT_BLAST_FILTER_CONFIG, DEFAULT_MSG_FORMAT), true);

  const classified = classifyDownSitesForBlast(sites, {
    formatConfig: DEFAULT_MSG_FORMAT,
    regionFilter: 'ALL',
  });
  assert.equal(classified.sitedown.length, 2);
  assert.equal(classified.bcch.length, 1);
  assert.equal(classified.celldown.length, 1);

  const pivotRows = [
    { monitoring: 'STOLLEN', cluster: 'Semarang' },
    { monitoring: 'POWER NOW', cluster: 'Semarang' },
    { monitoring: 'NETECO ALARM', cluster: 'Kudus' },
  ];
  const counts = getBlastFilterCounts({
    statusData: sites,
    pivotData: pivotRows,
    netdroneData: [{ skipped: false, matchedDb: true }, { skipped: true, matchedDb: true }],
    selectionMap,
    filterConfig: DEFAULT_BLAST_FILTER_CONFIG,
    formatConfig: DEFAULT_MSG_FORMAT,
  });

  assert.deepEqual(counts.sitedown, { selected: 2, total: 2 });
  assert.deepEqual(counts.bcch, { selected: 0, total: 1 });
  assert.deepEqual(counts.celldown, { selected: 0, total: 1 });
  assert.equal(counts.stolen, 1);
  assert.equal(counts.enva, 2);
  assert.equal(counts.netdrone, 1);
});

test('T027 TE message aggregation, item count, and multi-section formatting match contract', () => {
  const sites = [
    {
      status: 'DOWN',
      impact: 'Fully Down',
      new_site: '21SMG0010',
      old_site: 'OLD10',
      site_name: 'SITEDOWN ONE',
      cluster: 'Semarang 1',
      pic: 'Budi TE',
      rts: 'RTS 1',
      start_time: '01/05/2026 | 10:00',
      start_timestamp: 0,
      remark: 'FU Team',
      category: 'END SITE',
    },
    {
      status: 'DOWN',
      impact: 'Cell Down',
      new_site: '21SMG0011',
      old_site: 'OLD11',
      site_name: 'BCCH TWO',
      cluster: 'Semarang 2',
      pic: 'Budi TE',
      rts: 'RTS 2',
      start_time: '01/05/2026 | 10:05',
      start_timestamp: 0,
      remark: '',
      category: 'END SITE',
    },
    {
      status: 'DOWN',
      impact: 'Cell Down',
      new_site: '21SMG0012',
      old_site: 'OLD12',
      site_name: 'UNASSIGNED SITE',
      cluster: 'Demak',
      pic: '-',
      rts: 'RTS 3',
      start_time: '01/05/2026 | 10:10',
      start_timestamp: 0,
      remark: 'Waiting PLN',
      category: 'END SITE',
    },
  ];
  sites[1].remark = 'BCCH';

  const filterCfg = {
    ...DEFAULT_BLAST_FILTER_CONFIG,
    filterRemarkTrigger: false,
    enableEnva: true,
    enableStolen: true,
  };
  const pivotData = [
    { monitoring: 'STOLLEN', cluster: 'Semarang 1, Semarang 2', siteName: 'BATT SITE', newId: '21SMG0099' },
    { monitoring: 'NETECO', cluster: 'Semarang 1, Semarang 2', siteName: 'NETECO SITE', newId: '21SMG0098' },
  ];

  const groups = buildTeGroups({
    statusData: sites,
    netdroneData: [],
    pivotData,
    savedTeContacts: [{ name: 'Budi TE', cluster: 'Semarang 1', phone: '081234567890' }],
    regionFilter: 'ALL',
    selectionMap: {},
    filterConfig: filterCfg,
    formatConfig: DEFAULT_MSG_FORMAT,
  });

  assert.ok(groups['BUDI TE']);
  assert.equal(groups['BUDI TE'].phone, '081234567890');
  assert.equal(groups['BUDI TE'].cluster, 'Semarang 1, Semarang 2');
  assert.ok(groups['UNASSIGNED_DEMAK']);
  assert.equal(groups['UNASSIGNED_DEMAK'].name, '[Belum Ada TE] Demak');

  const count = getTeMessageItemCount(groups['BUDI TE'].sites, groups['BUDI TE'].cluster, {
    pivotData,
    selectionMap: {},
    filterConfig: filterCfg,
    formatConfig: DEFAULT_MSG_FORMAT,
  });
  assert.equal(count.total, 4);

  const text = generateTeMessage(groups['BUDI TE'].sites, groups['BUDI TE'].cluster, {
    pivotData,
    statusData: sites,
    selectionMap: {},
    filterConfig: filterCfg,
    formatConfig: DEFAULT_MSG_FORMAT,
  });

  assert.match(text, /\*STOLEN BATTERY :: 1\*/);
  assert.match(text, /\*SITEDOWN :: 1\*/);
  assert.match(text, /\*CELLDOWN BCCH :: 1\*/);
  assert.match(text, /\*ENVA NETECO :: 1\*/);
  assert.ok(text.indexOf('*STOLEN BATTERY') < text.indexOf('*SITEDOWN'));
  assert.ok(text.indexOf('*SITEDOWN') < text.indexOf('*ENVA NETECO'));
});

test('T027 generateShareBroadcastMessage builds regional WA summary cleanly', () => {
  const msg = generateShareBroadcastMessage(
    [
      {
        status: 'DOWN',
        impact: 'Fully Down',
        vendor: 'HUAWEI',
        cluster: 'Semarang',
        rts: 'RTS 1',
        new_site: '21SMG0001',
        site_name: 'SITE HUA',
        category: 'END SITE',
        start_time: '01/05/2026 | 08:00',
        start_timestamp: 0,
        remark: 'Check genset',
      },
      {
        status: 'DOWN',
        impact: 'Cell Down',
        vendor: 'NOKIA',
        cluster: 'Semarang',
        rts: 'RTS 2',
        new_site: '21SMG0002',
        site_name: 'SITE NOK',
        category: 'END SITE',
        start_time: '01/05/2026 | 08:05',
        start_timestamp: 0,
        remark: 'BCCH Missing',
      },
    ],
    {
      region: 'CJN',
      formatConfig: DEFAULT_BC_FORMAT,
      enableNetdrone: false,
      nowDate: new Date(2026, 4, 1, 10, 45, 0), // 10:45 -> rounds to 11:00 (odd hour -> hide remark)
    }
  );

  assert.match(msg, /\*SITE FULLY DOWN CJN/);
  assert.match(msg, /11\.00|11:00/);
  assert.match(msg, /\*TOTAL SITEDOWN : 1\*/);
  assert.match(msg, /\*SITE DOWN MOCN HUAWEI :: 1\*/);
  assert.doesNotMatch(msg, /Check genset/);
  assert.match(msg, /\*CELL DOWN BCCH Missing NOKIA : \(1\)\*/);
});

test('T027 daily broadcast logs reset on new date and format newest-first', () => {
  const storage = createMemoryStorage();
  const today = '12/11/2026';

  assert.deepEqual(loadBroadcastLogs(storage, today), []);

  let logs = appendBroadcastLog(storage, [], {
    success: 2,
    total: 2,
    groups: ['Group A', 'Group B'],
    dateStr: today,
    timeStr: '09.00.00',
  });
  logs = appendBroadcastLog(storage, logs, {
    success: 1,
    total: 2,
    groups: ['Group C', 'Group D'],
    dateStr: today,
    timeStr: '10.00.00',
  });

  assert.equal(loadBroadcastLogs(storage, today).length, 2);
  assert.deepEqual(loadBroadcastLogs(storage, '13/11/2026'), []);

  const display = formatBroadcastLogsDisplay(logs);
  const lines = display.trim().split('\n');
  assert.equal(lines.length, 2);
  assert.match(lines[0], /\[10\.00\.00\].*⚠️.*1\/2 berhasil.*Group C, Group D/);
  assert.match(lines[1], /\[09\.00\.00\].*✅.*2\/2 berhasil.*Group A, Group B/);
});

test('T027 WA session polling interval and presentation states map accurately', () => {
  assert.equal(resolveSessionPollInterval({ status: 'CONNECTED', isQrModalOpen: false }), 10000);
  assert.equal(resolveSessionPollInterval({ status: 'QR_READY', isQrModalOpen: false }), 1500);
  assert.equal(resolveSessionPollInterval({ status: 'DISCONNECTED', isQrModalOpen: true }), 1500);
  assert.equal(resolveSessionPollInterval({ status: 'DISCONNECTED', isStarting: true }), 1000);

  const qrUrl = buildQrCodeImageUrl('abc+123');
  assert.equal(qrUrl, 'https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=abc%2B123');

  const connected = getWaSessionPresentation({ status: 'CONNECTED', qr: null });
  assert.equal(connected.headerText, 'CONNECTED');
  assert.equal(connected.canSend, true);
  assert.equal(connected.showQr, false);

  const qrReady = getWaSessionPresentation({ status: 'QR_READY', qr: 'qr-payload' });
  assert.equal(qrReady.headerText, 'SCAN QR');
  assert.equal(qrReady.canSend, false);
  assert.equal(qrReady.showQr, true);
});

