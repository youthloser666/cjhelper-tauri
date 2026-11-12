import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_MSG_FORMAT,
  DEFAULT_BC_FORMAT,
  normalizeLegacyFormatConfig,
  loadFormatConfig,
  saveFormatConfig,
} from '../../../src/features/messages/logic/format-config.js';
import {
  formatSingleLine,
  convertPivotRowToSiteItem,
  formatPivotSiteLine,
} from '../../../src/features/messages/logic/line-formatter.js';
import {
  buildPmGroups,
  generatePmGroupText,
} from '../../../src/features/messages/logic/pm-grouping.js';
import { STORAGE_KEYS } from '../../../src/shared/state/storage-keys.js';

function createMemoryAdapter(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getJson(key, fallback) {
      return data.has(key) ? data.get(key) : fallback;
    },
    setJson(key, value) {
      data.set(key, value);
      return true;
    },
    remove(key) {
      data.delete(key);
      return true;
    },
  };
}

describe('format-config', () => {
  it('migrates legacy camelCase msg and bc configs seamlessly onto default templates', () => {
    const legacyMsg = normalizeLegacyFormatConfig(
      {
        msgLine: '{icon} {sitename}',
        msgRemark: ' -> {remark}',
        msgHdr: '{cluster}',
        iconDown: '🔻',
        lblSd: 'SD:',
        lblCd: 'CD:',
        lblBcch: 'BCCH:',
        keyBcch: 'MISSING_BCCH',
      },
      'msg'
    );

    assert.equal(legacyMsg.msg_line, '{icon} {sitename}');
    assert.equal(legacyMsg.msg_remark, ' -> {remark}');
    assert.equal(legacyMsg.icon_down, '🔻');
    assert.equal(legacyMsg.key_bcch, 'MISSING_BCCH');

    const legacyBc = normalizeLegacyFormatConfig(
      {
        msgLineBc: '{icon} {new}',
        msgRemarkBc: ' | {remark}',
        msgHdrBc: '*DOWN {region}*',
        lblSdBc: 'SITE:',
        lblCdBc: 'CELL:',
        section_bcch: 'NOKIA BCCH:',
      },
      'bc'
    );

    assert.equal(legacyBc.msg_line, '{icon} {new}');
    assert.equal(legacyBc.msg_hdr, '*DOWN {region}*');
    assert.equal(legacyBc.lbl_bcch, 'NOKIA BCCH:');
  });

  it('loads and saves format configs via injected storageAdapter using fixed keys', () => {
    const storage = createMemoryAdapter({
      [STORAGE_KEYS.FORMAT_MESSAGE]: { msgLine: '{icon} {new}' },
    });

    const loadedMsg = loadFormatConfig(storage, 'msg');
    assert.equal(loadedMsg.msg_line, '{icon} {new}');
    assert.equal(loadedMsg.lbl_sd, DEFAULT_MSG_FORMAT.lbl_sd);

    const updatedBc = { ...DEFAULT_BC_FORMAT, spacing: true };
    saveFormatConfig(storage, 'bc', updatedBc);
    assert.equal(loadFormatConfig(storage, 'bc').spacing, true);
  });
});

describe('line-formatter', () => {
  it('formats standard, critical/hub warning icons, BCCH detection, and UTC timestamps', () => {
    const standard = formatSingleLine(
      {
        impact: 'cell down',
        category: 'STANDARD',
        site_class: 'REGULAR',
        start_time: '08:00',
        start_timestamp: 0,
        cluster: 'Semarang',
        site_name: 'Tugu Muda',
        old_site: 'OLD1',
        new_site: '14SMG0001',
        remark: 'BCCH missing fault',
        rts: 'RTS_A',
        pic: 'Budi',
      },
      DEFAULT_MSG_FORMAT,
      true
    );

    assert.equal(standard.isFully, false);
    assert.equal(standard.isBcch, true);
    assert.match(standard.waLine, /^▶️ CELLS DOWN/);
    assert.match(standard.waLine, /↳ BCCH missing fault/);

    const hubWarning = formatSingleLine(
      {
        impact: 'Fully Down',
        category: 'BIG HUB SITE',
        site_class: 'STANDARD',
        start_timestamp: 1700000000,
        cluster: 'Solo',
        site_name: 'Solo Baru',
        old_site: '',
        new_site: '14SLO0002',
        remark: '',
        rts: 'RTS_B',
        pic: 'Andi',
      },
      DEFAULT_MSG_FORMAT,
      false
    );

    assert.equal(hubWarning.isFully, true);
    assert.equal(hubWarning.typeIcon, '⚠️ SITEDOWN');
    assert.match(hubWarning.waLine, /^⚠️ SITE DOWN/);
    assert.equal(hubWarning.time, '14/11/2023 | 22:13');
  });

  it('unifies Pivot site formatting across STOLLEN, CABLE STOLLEN, and ENVA categories', () => {
    const pivotRow = {
      monitoring: 'ENVA',
      system: 'ERICSSON',
      cluster: 'MC-Klaten',
      newId: '14KLT0012',
      siteName: '14KLT0012_Prambanan',
      tanggal: '2026-11-12 09:00',
      category: 'ENVA Power',
      teName: 'Doni',
      rtsName: 'RTS_KLT',
    };

    const item = convertPivotRowToSiteItem(pivotRow);
    assert.equal(item.new_site, '14KLT0012');
    assert.equal(item.site_name, 'Prambanan');
    assert.equal(item.cluster, 'Klaten');

    const envaLine = formatPivotSiteLine(pivotRow, DEFAULT_BC_FORMAT, { categoryOverride: 'ENVA' });
    const cableLine = formatPivotSiteLine(pivotRow, DEFAULT_BC_FORMAT, { categoryOverride: 'CABLE STOLLEN' });

    assert.match(envaLine, /14KLT0012.*Prambanan.*ENVA/);
    assert.match(cableLine, /14KLT0012.*Prambanan.*CABLE STOLLEN/);
  });
});

describe('pm-grouping', () => {
  const statusData = [
    {
      status: 'DOWN',
      impact: 'Fully Down',
      category: 'STANDARD',
      site_class: '',
      new_site: '14SMG0001',
      old_site: '',
      site_name: 'Tugu Muda',
      cluster: 'Semarang',
      pic: 'Budi',
      rts: 'RTS_SMG',
      start_time: '08:00',
      remark: 'PLN Off',
    },
    {
      status: 'DOWN',
      impact: 'Cell Down',
      category: 'STANDARD',
      site_class: '',
      new_site: '14SMG0002',
      old_site: '',
      site_name: 'Simpang Lima',
      cluster: 'Semarang',
      pic: '',
      rts: 'RTS_SMG',
      start_time: '09:00',
      remark: 'BCCH Issue',
    },
  ];

  it('groups down sites by cluster/TE PIC and classifies untitled TE + splits fully/cell/bcch', () => {
    const groups = buildPmGroups({
      statusData,
      pmMode: 'cluster',
      fmtMsg: DEFAULT_MSG_FORMAT,
      showRemark: true,
    });

    assert.equal(groups.length, 2);
    const unknownGroup = groups.find((group) => group.pic.startsWith('TE UNKNOWN'));
    assert.ok(unknownGroup);
    assert.equal(unknownGroup.cellBcch.length, 1);

    const budiGroup = groups.find((group) => group.pic === 'Budi');
    assert.ok(budiGroup);
    const rendered = generatePmGroupText(budiGroup, { formatConfig: DEFAULT_MSG_FORMAT, pmMode: 'cluster' });
    assert.match(rendered, /SITE DOWN :/);
    assert.match(rendered, /14SMG0001/);
  });

  it('groups by RTS in rts mode and generates summary RTS header', () => {
    const groups = buildPmGroups({
      statusData,
      pmMode: 'rts',
      fmtMsg: DEFAULT_MSG_FORMAT,
      showRemark: false,
    });

    assert.equal(groups.length, 1);
    const text = generatePmGroupText(groups[0], { formatConfig: DEFAULT_MSG_FORMAT, pmMode: 'rts' });
    assert.match(text, /RTS : RTS_SMG \(1 cluster: Semarang\) \| SD: 1 \| CD: 0/);
  });
});

