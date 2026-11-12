import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  MONTH_SHORT_NAMES,
  formatShortMonthDate,
  formatPivotDate,
  formatBroadcastIsoTimestamp,
  calculatePivotAging,
} from '../../../src/shared/utils/date-time.js';

describe('date-time helpers', () => {
  it('formats standard YYYY-MM-DD HH:mm timestamps and DD/MM/YYYY variants consistently', () => {
    assert.equal(formatPivotDate('2026-11-12 08:05:30'), '2026-11-12 08:05');
    assert.equal(formatPivotDate('12/11/2026 14:30:00'), '2026-11-12 14:30');
    assert.equal(formatPivotDate('2026-11-12T08:05:00'), '2026-11-12 08:05');
    assert.equal(formatPivotDate('12-Nov-26 09:45'), '2026-11-12 09:45');
    assert.equal(formatPivotDate(''), '');
    assert.equal(formatPivotDate('raw-unparsed'), 'raw-unparsed');
  });

  it('classifies aging buckets deterministically against injected referenceNowMs', () => {
    const baseMs = new Date(2026, 10, 12, 12, 0, 0).getTime();

    assert.equal(
      calculatePivotAging('2026-11-12 10:30:00', { referenceNowMs: baseMs }),
      '0 - 2 Hours'
    );
    assert.equal(
      calculatePivotAging('2026-11-12 09:00:00', { referenceNowMs: baseMs }),
      '2 - 4 Hours'
    );
    assert.equal(
      calculatePivotAging('2026-11-12 06:00:00', { referenceNowMs: baseMs }),
      '4 - 8 Hours'
    );
    assert.equal(
      calculatePivotAging('2026-11-11 22:00:00', { referenceNowMs: baseMs }),
      '8 - 24 Hours'
    );
    assert.equal(
      calculatePivotAging('2026-11-10 08:00:00', { referenceNowMs: baseMs }),
      '> 24 Hours'
    );
    assert.equal(calculatePivotAging('', { referenceNowMs: baseMs }), '0 - 2 Hours');
  });

  it('formats title-case short month dates and full Broadcast ISO timestamps safely', () => {
    assert.equal(MONTH_SHORT_NAMES.length, 12);
    assert.equal(formatShortMonthDate(new Date(2026, 10, 12, 10, 0, 0)), '12-Nov-2026');
    assert.equal(formatShortMonthDate('2026-05-03 08:15:00'), '03-May-2026');
    assert.equal(formatShortMonthDate(''), '');

    const epochUtc = Math.floor(Date.UTC(2026, 10, 7, 15, 8, 49) / 1000);
    assert.equal(formatBroadcastIsoTimestamp(epochUtc), '2026-11-07 15:08:49');
    assert.equal(formatBroadcastIsoTimestamp(0, '07/11/2026 17:15:47'), '2026-11-07 17:15:47');
    assert.equal(formatBroadcastIsoTimestamp('2026-11-07 17:04:00'), '2026-11-07 17:04:00');
    assert.equal(formatBroadcastIsoTimestamp(''), '');
    assert.equal(formatBroadcastIsoTimestamp(0, 'not-a-date'), 'not-a-date');
  });
});
