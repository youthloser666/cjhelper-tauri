import test from 'node:test';
import assert from 'node:assert/strict';

import { STORAGE_KEYS } from '../../../src/shared/state/storage-keys.js';
import {
  extractSiteEditorFields,
  buildSiteEditPayload,
  extractLookupDisplayFields,
} from '../../../src/features/database/logic/site-editor-service.js';
import {
  createInitialSiteChangesState,
  loadSiteChangesAutosave,
  saveSiteChangesAutosave,
  recordSiteHandoverChange,
  recordBulkHandoverChanges,
  recordSiteEditChange,
  revertSiteChange,
  resetAllSiteChanges,
  exportSiteChangesJsonPayload,
  parseAndMergeSiteChangesJson,
  filterHandoverHistory,
} from '../../../src/features/database/logic/site-changes-manager.js';
import {
  filterTeContacts,
  addTeContact,
  upsertTeContactFromSiteEdit,
  compactTeContacts,
} from '../../../src/features/database/logic/te-contacts-service.js';
import {
  filterWaGroups,
  buildSavedWaGroupsPayload,
  formatWaGroupCountLabel,
} from '../../../src/features/database/logic/wa-groups-service.js';
import {
  collectHandoverTeNames,
  computeTeHandoverPreview,
  validateBulkTeHandoverInput,
  parseBatchSiteIds,
  validateSiteHandoverRequest,
} from '../../../src/features/database/logic/handover-service.js';

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
    remove(key) {
      store.delete(key);
    },
  };
}

test('T028 site editor extracts exact + alternate DB columns and builds update_site_db payload cleanly', () => {
  const row = {
    'Site ID (New)': '21SMG0001',
    'Site Name': 'SEMARANG BARAT',
    'Old Site ID': 'SMG01',
    'Cluster (MC)': 'Semarang',
    'FM Office': 'Semarang',
    Area: 'CJN',
    Vendor: 'HUAWEI',
    Longitude: '110.4',
    Latitude: '-7.0',
    TLP: 'Protelindo',
    'RTS NEW': 'Rudi RTS',
    'TE Name': 'Budi',
    'TE Phone': '08123456789',
    'Mplane IP Address': 'http://10.1.2.3',
  };

  const fields = extractSiteEditorFields(row, '21SMG0001');
  assert.equal(fields.site_id, '21SMG0001');
  assert.equal(fields.site_name, 'SEMARANG BARAT');
  assert.equal(fields.cluster, 'Semarang');
  assert.equal(fields.rts_new, 'Rudi RTS');
  assert.equal(fields.te_name, 'Budi');

  const altRow = {
    SITE_ID_MSH: '21KDS0002',
    CLUSTER: 'Kudus',
    SITE_NAME: 'KUDUS KOTA',
    TE_NAME: 'Andi',
  };
  const altFields = extractSiteEditorFields(altRow, '21KDS0002');
  assert.equal(altFields.site_id, '21KDS0002');
  assert.equal(altFields.cluster, 'Kudus');
  assert.equal(altFields.site_name, 'KUDUS KOTA');
  assert.equal(altFields.te_name, 'Andi');

  const payload = buildSiteEditPayload({
    ...fields,
    te_name: '  Siti Baru  ',
    te_phone: ' 089999999 ',
  });
  assert.equal(payload.site_id, '21SMG0001');
  assert.equal(payload.te_name, 'Siti Baru');
  assert.equal(payload.te_phone, '089999999');

  const lookup = extractLookupDisplayFields(row);
  assert.equal(lookup['site-id-new'], '21SMG0001');
  assert.equal(lookup['mplane-ip-address'], 'http://10.1.2.3');
  assert.equal(lookup['cme-email'], '—');
});

test('T028 SiteChangesManager persists overrides, handovers, site edits, revert, reset, and JSON merge', () => {
  const storage = createMemoryStorage();
  let state = loadSiteChangesAutosave(storage);
  assert.deepEqual(state, createInitialSiteChangesState());

  state = recordSiteHandoverChange(storage, state, {
    site_id: ' 21smg0001 ',
    site_name: 'ALPHA',
    cluster: 'Semarang',
    old_te: 'Lama',
    new_te: 'Baru',
    new_phone: '08111',
    note: 'Shift',
    timestamp: '12/11/2026 09:00',
  });
  assert.ok(state.siteOverrides['21SMG0001']);
  assert.equal(state.siteOverrides['21SMG0001'].te_name, 'Baru');
  assert.equal(state.handoverHistory.length, 1);

  state = recordBulkHandoverChanges(
    storage,
    state,
    [
      { site_id: '21kds0002', site_name: 'BETA', cluster: 'Kudus', old_te: 'X', new_te: 'Y', new_te_phone: '08222' },
    ],
    'Massal'
  );
  assert.equal(Object.keys(state.siteOverrides).length, 2);
  assert.equal(state.handoverHistory.length, 2);

  state = recordSiteEditChange(storage, state, '21SMG0001', {
    site_name: 'ALPHA EDITED',
    cluster: 'Semarang',
    te_name: 'Baru',
    te_phone: '08111',
  });
  assert.equal(state.siteOverrides['21SMG0001'].fields.SITE_NAME, 'ALPHA EDITED');

  const persisted = storage.getJson(STORAGE_KEYS.SITE_CHANGES_AUTOSAVE);
  assert.equal(Object.keys(persisted.overrides).length, 2);
  assert.equal(persisted.handovers.length, 2);

  assert.equal(filterHandoverHistory(state.handoverHistory, 'kudus').length, 1);

  const jsonPayload = exportSiteChangesJsonPayload(state);
  assert.equal(jsonPayload.schema_version, 1);
  assert.equal(jsonPayload.stats.total_modified_sites, 2);

  state = revertSiteChange(storage, state, '21SMG0001');
  assert.equal(state.siteOverrides['21SMG0001'], undefined);
  assert.equal(state.handoverHistory.length, 1);

  state = parseAndMergeSiteChangesJson(
    storage,
    state,
    JSON.stringify({
      overrides: { '21SOL0003': { site_id: '21SOL0003', te_name: 'Tono', cluster: 'Solo' } },
      handovers: [{ id: 'ho_ext_1', site_id: '21SOL0003', new_te: 'Tono', timestamp: 't1' }],
    }),
    'import.json'
  );
  assert.equal(state.lastLoadedFileName, 'import.json');
  assert.equal(Object.keys(state.siteOverrides).length, 2);
  assert.equal(state.handoverHistory.length, 2);

  state = resetAllSiteChanges(storage);
  assert.deepEqual(state, createInitialSiteChangesState());
  assert.equal(storage.getJson(STORAGE_KEYS.SITE_CHANGES_AUTOSAVE, null), null);
});

test('T028 TE contacts and WA groups services validate CRUD, duplicate checks, filter, and save payloads', () => {
  const initialContacts = [
    { name: 'Budi', cluster: 'Semarang', phone: '08123456' },
    { name: 'Ani', cluster: 'Solo', phone: '08987654' },
  ];

  assert.equal(filterTeContacts(initialContacts, 'solo').length, 1);

  const dupResult = addTeContact(initialContacts, { name: 'budi', cluster: 'SEMARANG', phone: '0800' });
  assert.equal(dupResult.ok, false);
  assert.equal(dupResult.reason, 'duplicate');

  const added = addTeContact(initialContacts, { name: 'Candra', cluster: 'Pati', phone: '08555' });
  assert.equal(added.ok, true);
  assert.equal(added.contacts.length, 3);

  const synced = upsertTeContactFromSiteEdit(added.contacts, {
    te_name: 'Budi',
    te_phone: '081111111',
    cluster: 'Semarang',
  });
  assert.equal(synced.find((c) => c.name === 'Budi').phone, '081111111');

  const compacted = compactTeContacts([...synced, { name: ' ', cluster: 'X', phone: '1' }]);
  assert.equal(compacted.length, 3);

  const waGroups = [
    { id: '123@g.us', name: 'NOC CJN' },
    { id: '456@g.us', name: 'Monitoring Solo' },
  ];
  assert.equal(filterWaGroups(waGroups, 'solo').length, 1);

  const selectedIds = new Set(['123@g.us']);
  assert.deepEqual(buildSavedWaGroupsPayload(waGroups, selectedIds), [
    { group_id: '123@g.us', group_name: 'NOC CJN' },
  ]);
  assert.equal(formatWaGroupCountLabel({ total: 2, visible: 1, selected: 1, filter: 'solo' }), '1/2 (1 terpilih)');
  assert.equal(formatWaGroupCountLabel({ total: 2, visible: 2, selected: 1, filter: '' }), '1 terpilih');
});

test('T028 handover service validates single, bulk, and batch site inputs accurately', () => {
  const contacts = [
    { name: 'Budi', cluster: 'Semarang', phone: '08123' },
    { name: '[No TE] Demak', cluster: 'Demak', phone: '08000' },
  ];
  const statuses = [
    { new_site: '21SMG0001', pic: 'Budi', cluster: 'Semarang' },
    { new_site: '21SMG0002', pic: 'Budi', cluster: 'Demak' },
    { new_site: '21SMG0003', pic: 'UNKNOWN TE', cluster: 'Pati' },
  ];

  const names = collectHandoverTeNames(contacts, statuses);
  assert.deepEqual(names, ['Budi']);

  const preview = computeTeHandoverPreview('Budi', contacts, statuses);
  assert.deepEqual(preview.clusters, ['Demak', 'Semarang']);
  assert.equal(preview.contactPhone, '08123');
  assert.equal(preview.siteCount, 2);

  assert.equal(validateBulkTeHandoverInput({ oldTeName: '', newTeName: 'X' }).ok, false);
  assert.equal(validateBulkTeHandoverInput({ oldTeName: 'Budi', newTeName: '' }).ok, false);
  assert.equal(validateBulkTeHandoverInput({ oldTeName: 'Budi', newTeName: 'Andi' }).ok, true);

  assert.deepEqual(parseBatchSiteIds('21smg0001, 21kds0002\n21sol0003;'), [
    '21SMG0001',
    '21KDS0002',
    '21SOL0003',
  ]);

  assert.equal(validateSiteHandoverRequest({ newTeName: '', siteIds: ['A'] }).ok, false);
  assert.equal(validateSiteHandoverRequest({ newTeName: 'Budi', siteIds: [] }).ok, false);
  assert.equal(validateSiteHandoverRequest({ newTeName: 'Budi', siteIds: ['21SMG0001'] }).ok, true);
});

