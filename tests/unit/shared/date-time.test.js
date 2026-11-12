import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  formatPivotDate,
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
});
