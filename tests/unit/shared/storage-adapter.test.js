import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { STORAGE_KEYS } from '../../../src/shared/state/storage-keys.js';
import { createStorageAdapter } from '../../../src/shared/adapters/storage-adapter.js';

function createMemoryStorage(initial = {}) {
  const store = new Map(Object.entries(initial));
  return {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(key, String(value));
    },
    removeItem(key) {
      store.delete(key);
    },
  };
}

describe('STORAGE_KEYS contract', () => {
  it('defines all 11 fixed legacy localStorage keys exactly', () => {
    assert.deepEqual(Object.values(STORAGE_KEYS).sort(), [
      'cjhelper_bc_logs',
      'cjhelper_blast_filter_cfg',
      'cjhelper_carto_api_key',
      'cjhelper_map_tile_type',
      'cjhelper_netdrone_data',
      'cjhelper_netdrone_text',
      'cjhelper_pivot_data',
      'cjhelper_pivot_text',
      'cjhelper_site_changes_autosave',
      'fmtBc',
      'fmtMsg',
    ]);
    assert.equal(Object.isFrozen(STORAGE_KEYS), true);
  });
});

describe('createStorageAdapter', () => {
  it('stores and retrieves strings and JSON values safely', () => {
    const adapter = createStorageAdapter({ backend: createMemoryStorage() });

    assert.equal(adapter.setString(STORAGE_KEYS.MAP_TILE_TYPE, 'osm'), true);
    assert.equal(adapter.getString(STORAGE_KEYS.MAP_TILE_TYPE, 'auto'), 'osm');

    const payload = { date: '12/11/2026', logs: [{ id: 1, ok: true }] };
    assert.equal(adapter.setJson(STORAGE_KEYS.BROADCAST_LOGS, payload), true);
    assert.deepEqual(adapter.getJson(STORAGE_KEYS.BROADCAST_LOGS, null), payload);

    assert.equal(adapter.remove(STORAGE_KEYS.MAP_TILE_TYPE), true);
    assert.equal(adapter.getString(STORAGE_KEYS.MAP_TILE_TYPE, 'auto'), 'auto');
  });

  it('catches malformed JSON, logs a warning, and returns fallback default without halting', () => {
    const warnings = [];
    const adapter = createStorageAdapter({
      backend: createMemoryStorage({
        [STORAGE_KEYS.FORMAT_MESSAGE]: '{broken-json',
      }),
      logger: {
        warn: (...args) => warnings.push(args.join(' ')),
      },
    });

    const fallback = { showHeader: true };
    const result = adapter.getJson(STORAGE_KEYS.FORMAT_MESSAGE, fallback);

    assert.deepEqual(result, fallback);
    assert.equal(warnings.length, 1);
    assert.match(warnings[0], /fmtMsg/);
  });

  it('returns fallback cleanly when storage backend throws or is unavailable', () => {
    const warnings = [];
    const throwingBackend = {
      getItem() {
        throw new Error('Quota denied');
      },
      setItem() {
        throw new Error('Quota exceeded');
      },
      removeItem() {
        throw new Error('Unavailable');
      },
    };
    const adapter = createStorageAdapter({
      backend: throwingBackend,
      logger: {
        warn: (...args) => warnings.push(args.join(' ')),
      },
    });

    assert.deepEqual(adapter.getJson(STORAGE_KEYS.PIVOT_DATA, []), []);
    assert.equal(adapter.setJson(STORAGE_KEYS.PIVOT_DATA, [1]), false);
    assert.equal(adapter.getString(STORAGE_KEYS.CARTO_API_KEY, 'none'), 'none');
    assert.equal(adapter.setString(STORAGE_KEYS.CARTO_API_KEY, 'secret'), false);
    assert.equal(adapter.remove(STORAGE_KEYS.CARTO_API_KEY), false);
    assert.equal(warnings.length, 5);
  });
});

