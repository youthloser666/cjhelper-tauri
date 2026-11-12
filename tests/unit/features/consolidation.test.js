import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import assert from 'node:assert/strict';

import { DEFAULT_BC_FORMAT } from '../../../src/features/messages/logic/format-config.js';
import { formatPivotSiteLine } from '../../../src/features/messages/logic/line-formatter.js';
import { detectRegion } from '../../../src/shared/utils/region-detector.js';
import {
  buildSiteEditPayload,
  extractSiteEditorFields,
} from '../../../src/features/database/logic/site-editor-service.js';
import {
  createInitialSiteChangesState,
  recordSiteEditChange,
} from '../../../src/features/database/logic/site-changes-manager.js';
import { STORAGE_KEYS } from '../../../src/shared/state/storage-keys.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SRC_ROOT = path.resolve(__dirname, '../../../src');

function createMemoryStorage() {
  const store = new Map();
  return {
    getJson(key, fallback = null) {
      return store.has(key) ? store.get(key) : fallback;
    },
    setJson(key, value) {
      store.set(key, value);
      return true;
    },
    remove(key) {
      store.delete(key);
      return true;
    },
  };
}

test('T057 unified formatPivotSiteLine handles Stolen Battery, Stolen Cable, and Enva variants identically', () => {
  const basePivotRow = {
    monitoring: 'STOLLEN',
    system: 'NOKIA',
    cluster: 'MC-Semarang',
    newId: '14SMG0099',
    siteName: '14SMG0099_Tembalang',
    tanggal: '2026-11-12 08:30',
    category: 'Stolen Battery',
    teName: 'Budi',
    rtsName: 'RTS_SMG',
  };

  const stolenBatteryLine = formatPivotSiteLine(basePivotRow, DEFAULT_BC_FORMAT, {
    categoryOverride: 'STOLLEN',
  });
  const stolenCableLine = formatPivotSiteLine(
    { ...basePivotRow, monitoring: 'CABLE STOLLEN', category: 'Cable Cut' },
    DEFAULT_BC_FORMAT,
    { categoryOverride: 'CABLE STOLLEN' }
  );
  const envaLine = formatPivotSiteLine(
    { ...basePivotRow, monitoring: 'ENVA', category: 'High Temp' },
    DEFAULT_BC_FORMAT,
    { categoryOverride: 'ENVA' }
  );

  assert.match(stolenBatteryLine, /14SMG0099.*Tembalang.*STOLLEN/);
  assert.match(stolenCableLine, /14SMG0099.*Tembalang.*CABLE STOLLEN/);
  assert.match(envaLine, /14SMG0099.*Tembalang.*ENVA/);
});

test('T057 unified detectRegion resolves explicit markers, municipalities, legacy keys, and defaults', () => {
  assert.equal(detectRegion({ rawRegion: 'CJS' }), 'CJS');
  assert.equal(detectRegion({ cluster: 'SOUTH SOLO' }), 'CJS');
  assert.equal(detectRegion({ cluster: 'Pekalongan Barat' }), 'CJN');
  assert.equal(detectRegion({ cluster: 'Klaten Selatan' }), 'CJS');
  assert.equal(detectRegion({ site_name: 'Banyumas Site', pic: '' }), 'CJS');
  assert.equal(detectRegion({ siteName: 'Unknown Area' }), 'CJN');
});

test('T057 unified Database Editor extract/save/undo transitions keep form and autosave consistent', () => {
  const originalDbRow = {
    'Site ID (New)': '14SMG0001',
    'Site Name': 'Tugu Muda',
    'Cluster (MC)': 'Semarang',
    TE_NAME: 'Budi',
    TE_PHONE: '08123456789',
  };

  // Phase 1: loaded from lookup
  const loadedForm = extractSiteEditorFields(originalDbRow, '14SMG0001');
  assert.equal(loadedForm.site_id, '14SMG0001');
  assert.equal(loadedForm.te_name, 'Budi');

  // Phase 2: dirty edit
  const dirtyForm = {
    ...loadedForm,
    te_name: 'Andi',
    te_phone: '08998877665',
  };
  const editPayload = buildSiteEditPayload(dirtyForm);
  assert.equal(editPayload.te_name, 'Andi');
  assert.equal(editPayload.te_phone, '08998877665');

  // Phase 3: saved_in_memory persisted into SiteChangesManager
  const storage = createMemoryStorage();
  const initialChanges = createInitialSiteChangesState();
  const nextChanges = recordSiteEditChange(storage, initialChanges, editPayload.site_id, editPayload);

  assert.equal(nextChanges.siteOverrides['14SMG0001'].te_name, 'Andi');
  const persisted = storage.getJson(STORAGE_KEYS.SITE_CHANGES_AUTOSAVE);
  assert.equal(persisted.overrides['14SMG0001'].te_name, 'Andi');

  // Phase 4: Undo restores from cached originalDbRow cleanly
  const restoredForm = extractSiteEditorFields(originalDbRow, '14SMG0001');
  assert.equal(restoredForm.te_name, 'Budi');
  assert.equal(restoredForm.te_phone, '08123456789');
});

test('T057 repository consolidation: single canonical Database Editor controller without duplicate copies', () => {
  const dbEditorPath = path.join(SRC_ROOT, 'features/database/ui/database-editor.view.js');
  const dbEditorContent = fs.readFileSync(dbEditorPath, 'utf8');

  const searchBtnMatches = dbEditorContent.match(/btn-db-edit-search/g) || [];
  const saveBtnMatches = dbEditorContent.match(/btn-db-edit-save/g) || [];
  assert.equal(searchBtnMatches.length, 1);
  assert.equal(saveBtnMatches.length, 1);
});
