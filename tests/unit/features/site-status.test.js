import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  filterAndSortSiteStatuses,
  computeStatusCounts,
  resolveStatusBadges,
} from '../../../src/features/site-status/logic/status-filter.js';
import {
  formatSiteStatusClipboardLine,
  formatSiteStatusBatchCopy,
} from '../../../src/features/site-status/logic/share-whatsapp-formatter.js';

describe('site-status filtering and sorting', () => {
  const sampleStatuses = [
    {
      new_site: '14SMG0001',
      site_name: 'Tugu Muda',
      cluster: 'Semarang',
      status: 'DOWN',
      rts: 'Budi',
      impact: 'Fully Down',
      agging: '2d',
      start_timestamp: 1000,
      icon: '🔴',
    },
    {
      new_site: '14SLO0002',
      site_name: 'Solo Square',
      cluster: 'Solo',
      status: 'UP',
      rts: 'Andi',
      impact: 'Partial',
      agging: '1h',
      start_timestamp: 3000,
      icon: '🟢',
    },
    {
      new_site: '14SMG0003',
      site_name: 'Simpang Lima',
      cluster: 'Semarang',
      status: 'DOWN',
      rts: 'Andi',
      impact: 'Cell Down',
      agging: '10h',
      start_timestamp: 2000,
      icon: '🟡',
    },
  ];

  it('filters by region, status state, and cluster/site search query', () => {
    const cjnDown = filterAndSortSiteStatuses(sampleStatuses, {
      regionFilter: 'CJN',
      statusFilter: 'DOWN',
      searchQuery: 'simpang',
      sortOrder: 'none',
    });

    assert.equal(cjnDown.length, 1);
    assert.equal(cjnDown[0].new_site, '14SMG0003');
  });

  it('sorts by RTS default ascending, longest duration (desc), or newest (asc)', () => {
    const defaultSorted = filterAndSortSiteStatuses(sampleStatuses, {
      regionFilter: 'ALL',
      statusFilter: 'DOWN',
      sortOrder: 'none',
    });
    assert.deepEqual(defaultSorted.map((item) => item.new_site), ['14SMG0003', '14SMG0001']);

    const longestSorted = filterAndSortSiteStatuses(sampleStatuses, {
      regionFilter: 'ALL',
      statusFilter: 'ALL',
      sortOrder: 'desc',
    });
    assert.deepEqual(
      longestSorted.map((item) => item.new_site),
      ['14SMG0001', '14SMG0003', '14SLO0002']
    );

    const newestSorted = filterAndSortSiteStatuses(sampleStatuses, {
      regionFilter: 'ALL',
      statusFilter: 'ALL',
      sortOrder: 'asc',
    });
    assert.deepEqual(
      newestSorted.map((item) => item.new_site),
      ['14SLO0002', '14SMG0003', '14SMG0001']
    );
  });

  it('computes region UP/DOWN counters and badge severity classes cleanly', () => {
    assert.deepEqual(computeStatusCounts(sampleStatuses, 'CJN'), { upCount: 0, downCount: 2 });
    assert.deepEqual(resolveStatusBadges(sampleStatuses[0]), { impactClass: 'br', agingClass: 'br' });
    assert.deepEqual(resolveStatusBadges(sampleStatuses[2]), { impactClass: 'bb', agingClass: 'bb' });
    assert.deepEqual(resolveStatusBadges({ impact: 'Partial', agging: '8-24 hours' }), {
      impactClass: 'bb',
      agingClass: 'ba',
    });
  });
});

describe('site-status clipboard/share formatter', () => {
  const sampleStatuses = [
    { new_site: '14SMG0001', site_name: 'Tugu Muda', cluster: 'Semarang', status: 'DOWN', icon: '🔴' },
    { new_site: '14SLO0002', site_name: 'Solo Square', cluster: 'Solo', status: 'UP', icon: '🟢' },
  ];

  it('formats single lines and DOWN/UP/ALL batch copy strings consistently', () => {
    assert.equal(
      formatSiteStatusClipboardLine(sampleStatuses[0]),
      '14SMG0001 - Tugu Muda - Semarang 🔴'
    );
    assert.equal(
      formatSiteStatusBatchCopy(sampleStatuses, 'DOWN'),
      '14SMG0001 - Tugu Muda - Semarang 🔴'
    );
    assert.equal(
      formatSiteStatusBatchCopy(sampleStatuses, 'UP'),
      '14SLO0002 - Solo Square - Solo 🟢'
    );
    assert.equal(
      formatSiteStatusBatchCopy(sampleStatuses, 'ALL'),
      '14SMG0001 - Tugu Muda - Semarang 🔴\n14SLO0002 - Solo Square - Solo 🟢'
    );
  });
});

