import test from 'node:test';
import assert from 'node:assert/strict';

import { STORAGE_KEYS } from '../../../src/shared/state/storage-keys.js';
import {
  loadMapTileConfig,
  saveMapTileType,
  saveCartoApiKey,
  resolveTileLayerSpecs,
} from '../../../src/features/maps/logic/map-tile-config.js';
import {
  parseCoordinateInput,
  classifyDownSiteMarker,
  enrichNearestSites,
  resolveMapSearchTarget,
} from '../../../src/features/maps/logic/map-sites-service.js';
import {
  normalizeStreetViewCoords,
  buildStreetViewEmbedUrl,
  buildExternalStreetViewUrl,
} from '../../../src/features/maps/logic/street-view-service.js';

function createMemoryStorage(initial = {}) {
  const store = new Map(Object.entries(initial));
  return {
    getString(key, fallback = '') {
      return store.has(key) ? store.get(key) : fallback;
    },
    setString(key, val) {
      store.set(key, String(val));
    },
    remove(key) {
      store.delete(key);
    },
  };
}

test('T029 map tile resolution respects auto theme, explicit providers, and CARTO API key storage', () => {
  const storage = createMemoryStorage();
  assert.deepEqual(loadMapTileConfig(storage), { tileType: 'auto', cartoApiKey: '' });

  saveMapTileType(storage, 'satellite');
  saveCartoApiKey(storage, '  secret-key-123  ');
  assert.equal(storage.getString(STORAGE_KEYS.MAP_TILE_TYPE), 'satellite');
  assert.equal(storage.getString(STORAGE_KEYS.CARTO_API_KEY), 'secret-key-123');

  const darkAuto = resolveTileLayerSpecs({ tileType: 'auto', isLight: false, cartoApiKey: '' });
  assert.equal(darkAuto.length, 2);
  assert.match(darkAuto[0].url, /World_Dark_Gray_Base/);
  assert.match(darkAuto[1].url, /World_Dark_Gray_Reference/);

  const lightAuto = resolveTileLayerSpecs({ tileType: 'auto', isLight: true, cartoApiKey: '' });
  assert.equal(lightAuto.length, 1);
  assert.match(lightAuto[0].url, /tile\.openstreetmap\.org/);

  const cartoLight = resolveTileLayerSpecs({
    tileType: 'carto',
    isLight: true,
    cartoApiKey: 'abc999',
  });
  assert.equal(cartoLight.length, 1);
  assert.match(cartoLight[0].url, /light_all.*key=abc999/);

  const cartoMissingKey = resolveTileLayerSpecs({
    tileType: 'carto',
    isLight: false,
    cartoApiKey: '',
  });
  assert.equal(cartoMissingKey.length, 2);
  assert.match(cartoMissingKey[0].url, /World_Dark_Gray_Base/);

  saveCartoApiKey(storage, '  ');
  assert.equal(storage.getString(STORAGE_KEYS.CARTO_API_KEY, 'REMOVED'), 'REMOVED');
});

test('T029 coordinate parsing, down-site marker classification, and search resolution work cleanly', async () => {
  assert.deepEqual(parseCoordinateInput(' -6.9812 , 110.4205 '), {
    lat: -6.9812,
    lon: 110.4205,
  });
  assert.equal(parseCoordinateInput('Semarang'), null);
  assert.equal(parseCoordinateInput('0, 0'), null);

  assert.deepEqual(
    classifyDownSiteMarker({ impact: 'Fully Down', remark: '' }),
    { typeLabel: 'SITE DOWN', tone: 'down' }
  );
  assert.deepEqual(
    classifyDownSiteMarker({ impact: 'Partial Cell', remark: 'BCCH Missing' }),
    { typeLabel: 'CELLS DOWN', tone: 'bcch' }
  );
  assert.deepEqual(
    classifyDownSiteMarker({ impact: 'Partial Cell', remark: 'PLN' }),
    { typeLabel: 'CELLS DOWN', tone: 'cell' }
  );

  const enriched = enrichNearestSites(
    [
      { site_id: '21SMG0001', site_name: 'ALPHA', lat: -6.9, lon: 110.4, distance_km: 1.2 },
      { site_id: '21SMG0002', site_name: 'BETA', lat: -7.0, lon: 110.5, distance_km: 2.3 },
    ],
    [{ new_site: '21SMG0001', status: 'DOWN', start_time: '10:00', remark: 'PLN Off' }]
  );
  assert.equal(enriched[0].isDown, true);
  assert.equal(enriched[0].downData.remark, 'PLN Off');
  assert.equal(enriched[1].isDown, false);

  const coordTarget = await resolveMapSearchTarget('-6.98, 110.42', {});
  assert.deepEqual(coordTarget, { lat: -6.98, lon: 110.42, title: '-6.98, 110.42', isSite: false });

  const dbTarget = await resolveMapSearchTarget('21SMG0001', {
    lookupSite: async () => ({ 'Site Name': 'ALPHA TOWER', Latitude: '-6.99', Longitude: '110.41' }),
  });
  assert.equal(dbTarget.isSite, true);
  assert.equal(dbTarget.title, 'ALPHA TOWER');
  assert.equal(dbTarget.lat, -6.99);

  const geoTarget = await resolveMapSearchTarget('Simpang Lima Semarang', {
    lookupSite: async () => null,
    geocode: async () => [{ lat: '-6.990', lon: '110.423', display_name: 'Simpang Lima' }],
  });
  assert.equal(geoTarget.isSite, false);
  assert.equal(geoTarget.title, 'Simpang Lima');
});

test('T029 Street View coordinate normalization and embed/external URLs format accurately', () => {
  const normalized = normalizeStreetViewCoords('-6.99', '110.42');
  assert.deepEqual(normalized, {
    lat: -6.99,
    lon: 110.42,
    title: '-6.990000, 110.420000',
    coordsLabel: '-6.990000, 110.420000',
  });

  const panoUrl = buildStreetViewEmbedUrl(-6.99, 110.42, 'pano');
  assert.match(panoUrl, /^https:\/\/www\.google\.com\/maps\/embed\?origin=mfe&pb=.*!1d-6\.99!2d110\.42/);

  const satUrl = buildStreetViewEmbedUrl(-6.99, 110.42, 'sat');
  assert.equal(satUrl, 'https://maps.google.com/maps?q=-6.99,110.42&t=k&z=19&output=embed');

  const extUrl = buildExternalStreetViewUrl(-6.99, 110.42);
  assert.equal(extUrl, 'http://maps.google.com/maps?q=&layer=c&cbll=-6.99,110.42');
});

