import test from 'node:test';
import assert from 'node:assert/strict';

import { STORAGE_KEYS } from '../../../src/shared/state/storage-keys.js';
import {
  DEFAULT_MSG_FORMAT,
  DEFAULT_BC_FORMAT,
} from '../../../src/features/messages/logic/format-config.js';
import {
  buildFormatterPreview,
  getDefaultFormatForTarget,
  loadFormatterSettings,
  resetFormatterTarget,
  saveFormatterTarget,
  serializeFormatterForm,
} from '../../../src/features/settings/logic/formatter-settings-service.js';
import {
  createInitialUpdaterState,
  reduceUpdaterState,
} from '../../../src/features/settings/logic/system-updater-service.js';

function createMemoryJsonStorage(initial = {}) {
  const store = new Map(Object.entries(initial));
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

test('T030 formatter settings serialization, save, preview, and reset preserve contract defaults', () => {
  const storage = createMemoryJsonStorage();

  const initial = loadFormatterSettings(storage);
  assert.equal(initial.msg.msg_line, DEFAULT_MSG_FORMAT.msg_line);
  assert.equal(initial.bc.msg_hdr, DEFAULT_BC_FORMAT.msg_hdr);

  const customForm = {
    msg_line: '{icon} [{cluster}] {sitename}',
    msg_remark: ' -> {remark}',
    msg_hdr: '{cluster} | {pic}',
    lbl_sd: '*DOWN:*',
    lbl_cd: '*CELL:*',
    lbl_bcch: '*BCCH:*',
    key_bcch: 'BCCH',
    icon_down: '🔸',
    spacing: true,
  };

  const serialized = serializeFormatterForm(customForm, 'msg');
  assert.equal(serialized.spacing, true);
  assert.equal(serialized.icon_down, '🔸');

  saveFormatterTarget(storage, 'msg', customForm);
  const stored = storage.getJson(STORAGE_KEYS.FORMAT_MESSAGE);
  assert.equal(stored.msg_line, '{icon} [{cluster}] {sitename}');
  assert.equal(stored.spacing, true);

  const previewMsg = buildFormatterPreview(serialized, 'msg');
  assert.match(previewMsg, /\*DOWN:\*/);
  assert.match(previewMsg, /🔸/);
  assert.match(previewMsg, /\*BCCH:\*/);

  const previewBc = buildFormatterPreview(DEFAULT_BC_FORMAT, 'bc');
  assert.match(previewBc, /SITE DOWN VS POWER/);
  assert.match(previewBc, /Jujuk Ahmad Afif/);
  assert.match(previewBc, /\/ HIGH \//);
  assert.doesNotMatch(previewBc, /Budi/);

  const resetMsg = resetFormatterTarget(storage, 'msg');
  assert.deepEqual(resetMsg, getDefaultFormatForTarget('msg'));
  assert.equal(storage.getJson(STORAGE_KEYS.FORMAT_MESSAGE, null), null);
});

test('T030 system updater state machine handles check, progress percentage, completion, and errors', () => {
  let state = createInitialUpdaterState('2.0.4');
  assert.equal(state.status, 'idle');
  assert.equal(state.currentVersion, '2.0.4');
  assert.equal(state.canInstall, false);

  state = reduceUpdaterState(state, { type: 'CHECK_START' });
  assert.equal(state.status, 'checking');
  assert.equal(state.isChecking, true);

  state = reduceUpdaterState(state, { type: 'CHECK_UP_TO_DATE' });
  assert.equal(state.status, 'up_to_date');
  assert.equal(state.tone, 'success');
  assert.equal(state.canInstall, false);

  state = reduceUpdaterState(state, { type: 'CHECK_START' });
  state = reduceUpdaterState(state, { type: 'CHECK_AVAILABLE', version: '2.1.0' });
  assert.equal(state.status, 'available');
  assert.equal(state.availableVersion, '2.1.0');
  assert.equal(state.canInstall, true);

  state = reduceUpdaterState(state, { type: 'INSTALL_START' });
  assert.equal(state.status, 'downloading');
  assert.equal(state.isInstalling, true);

  state = reduceUpdaterState(state, { type: 'INSTALL_STARTED_EVENT', contentLength: 1000 });
  state = reduceUpdaterState(state, { type: 'INSTALL_PROGRESS_EVENT', chunkLength: 250 });
  assert.equal(state.progressPercent, 25);

  state = reduceUpdaterState(state, { type: 'INSTALL_PROGRESS_EVENT', chunkLength: 500 });
  assert.equal(state.progressPercent, 75);

  state = reduceUpdaterState(state, { type: 'INSTALL_FINISHED_EVENT' });
  assert.equal(state.status, 'restarting');
  assert.equal(state.progressPercent, 100);
  assert.equal(state.isInstalling, false);

  const errState = reduceUpdaterState(state, { type: 'CHECK_ERROR', error: 'Network timeout' });
  assert.equal(errState.status, 'error');
  assert.equal(errState.tone, 'error');
  assert.match(errState.statusMessage, /Network timeout/);
});

