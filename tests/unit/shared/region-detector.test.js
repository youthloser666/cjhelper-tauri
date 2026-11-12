import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  CJN_REGION_KEYWORDS,
  CJS_REGION_KEYWORDS,
  detectRegion,
} from '../../../src/shared/utils/region-detector.js';

describe('region-detector', () => {
  it('detects explicit CJS/SOUTH and CJN/NORTH markers first across inputs', () => {
    assert.equal(detectRegion({ rawRegion: 'Central Java South' }), 'CJS');
    assert.equal(detectRegion({ area: 'Area CJS 1' }), 'CJS');
    assert.equal(detectRegion({ remark: 'ROH NORTH' }), 'CJN');
    assert.equal(detectRegion({ rawRegion: 'CJN' }), 'CJN');
  });

  it('detects CJN and CJS municipalities from cluster, siteName, remark, and pic', () => {
    for (const keyword of ['Semarang', 'Demak', 'Kudus', 'Tegal', 'Kendal']) {
      assert.equal(detectRegion({ cluster: `Cluster ${keyword}` }), 'CJN');
    }

    for (const keyword of ['Solo', 'Surakarta', 'Boyolali', 'Magelang', 'Purwokerto', 'Cilacap']) {
      assert.equal(detectRegion({ siteName: `SITE_${keyword}_01` }), 'CJS');
    }

    assert.equal(detectRegion({ pic: 'TE Ahmad (Wonogiri)' }), 'CJS');
    assert.equal(detectRegion({ remark: 'Gangguan power Pati' }), 'CJN');
  });

  it('supports legacy snake_case keys and defaults unmatched inputs to CJN', () => {
    assert.equal(detectRegion({ site_name: 'Klaten Kota', cluster: '' }), 'CJS');
    assert.equal(detectRegion({ site_name: 'Unknown Site', cluster: '' }), 'CJN');
    assert.equal(detectRegion(null), 'CJN');
    assert.equal(CJN_REGION_KEYWORDS.includes('SEMARANG'), true);
    assert.equal(CJS_REGION_KEYWORDS.includes('KLATEN'), true);
  });
});

