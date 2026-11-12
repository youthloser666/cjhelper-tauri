import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  getDatabaseFieldValue,
  buildSiteDatabaseCopyText,
} from '../../../src/shared/utils/site-data.js';

describe('site-data helpers', () => {
  it('resolves exact DB column keys and loose token arrays without returning false role matches', () => {
    const siteRow = {
      'Site ID (New)': 'SMG001',
      'Old Site ID': 'SMG_OLD_01',
      'Site Name': 'Semarang Kota',
      'Cluster (MC)': 'Semarang',
      'TE Name': 'Budi Santoso',
      'TE Phone': '081234567890',
      'RTS Name': 'Rudi Hartono',
      'RTS Phone': '081999888777',
      'Latitude': '-6.9932',
      'Longitude': '110.4203',
    };

    assert.equal(getDatabaseFieldValue(siteRow, ['Site ID (New)']), 'SMG001');
    assert.equal(getDatabaseFieldValue(siteRow, ['SITE', 'ID', 'MSH']), 'SMG001');
    assert.equal(getDatabaseFieldValue(siteRow, ['SITE', 'NAME']), 'Semarang Kota');
    assert.equal(getDatabaseFieldValue(siteRow, ['RTS', 'PHONE']), '081999888777');
    assert.equal(getDatabaseFieldValue(siteRow, ['TE', 'PHONE']), '081234567890');
    assert.equal(getDatabaseFieldValue(siteRow, ['CME', 'PHONE']), '—');
    assert.equal(getDatabaseFieldValue(siteRow, ['LAT']), '-6.9932');
    assert.equal(getDatabaseFieldValue(siteRow, ['LONG']), '110.4203');
    assert.equal(getDatabaseFieldValue(null, ['Site Name']), '—');
  });

  it('builds complete 23-line site database clipboard summary text preserving em-dash defaults', () => {
    const row = {
      'Site ID (New)': 'SMG001',
      'Site Name': 'Semarang Kota',
      'Cluster (MC)': 'Semarang',
      'Vendor': 'Nokia',
    };

    const output = buildSiteDatabaseCopyText(row);
    const lines = output.split('\n');

    assert.equal(lines.length, 23);
    assert.equal(lines[0], 'Site ID (New): SMG001');
    assert.equal(lines[1], 'Old Site ID: —');
    assert.equal(lines[2], 'Site Name: Semarang Kota');
    assert.equal(lines[7], 'Vendor: Nokia');
    assert.equal(lines[22], 'Netact MRBTS: —');
  });
});

