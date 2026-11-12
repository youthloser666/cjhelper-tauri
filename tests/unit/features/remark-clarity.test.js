import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  REMARK_CLARITY_MODES,
  classifyRemarkClarity,
  matchesRemarkClarityFilter,
} from '../../../src/features/messages/logic/remark-clarity.js';

describe('remark-clarity classifier & Smart Filter', () => {
  it('classifies empty and placeholder values as empty', () => {
    for (const emptySample of ['', '   ', '-', '—', '--', '0', 'null', 'n/a', '?', '...']) {
      assert.equal(classifyRemarkClarity(emptySample), 'empty', `Expected '${emptySample}' to be empty`);
      assert.equal(matchesRemarkClarityFilter(emptySample, 'empty'), true);
      assert.equal(matchesRemarkClarityFilter(emptySample, 'unclear'), true);
      assert.equal(matchesRemarkClarityFilter(emptySample, 'clear'), false);
    }
  });

  it('classifies vague, transit otw/eta, priority, and fu notes as Needs Follow-Up (unclear)', () => {
    const unclearSamples = [
      'cek',
      'masih cek team',
      'monitoring',
      'pending',
      'fu team',
      'follow up',
      'follow up team',
      'team otw eta',
      'team otw eta 90 menit',
      'team otw',
      'priority',
      'koordinasi',
      'belum jelas',
      'no update',
      'investigate',
      'in progress',
      'xx',
    ];

    for (const sample of unclearSamples) {
      assert.equal(classifyRemarkClarity(sample), 'unclear', `Expected '${sample}' to be unclear`);
      assert.equal(matchesRemarkClarityFilter(sample, 'unclear'), true);
      assert.equal(matchesRemarkClarityFilter(sample, 'empty'), false);
      assert.equal(matchesRemarkClarityFilter(sample, 'clear'), false);
    }
  });

  it('classifies onsite actions, spare parts, progress req, and hardware causes as Actionable (clear)', () => {
    const clearSamples = [
      'PLN Off',
      'team onsite',
      'team onsite ts',
      'team onsite prepare BUG',
      'team onsite BUG',
      'team onsite stolen',
      'spare part CPRI Faulty',
      'CPRI Faulty',
      'progress req',
      'priority - team onsite ts',
      'fu team -> CPRI Faulty',
      'FO cut KM 12',
      'ganti baterai',
      'check genset rusak',
      'koordinasi pemilik lahan buka akses jam 14:00',
    ];

    for (const sample of clearSamples) {
      assert.equal(classifyRemarkClarity(sample), 'clear', `Expected '${sample}' to be clear`);
      assert.equal(matchesRemarkClarityFilter(sample, 'clear'), true);
      assert.equal(matchesRemarkClarityFilter(sample, 'unclear'), false);
    }
  });

  it('evaluates 500 outage sites well under the 100ms SC-004 budget', () => {
    assert.deepEqual(REMARK_CLARITY_MODES, ['all', 'unclear', 'empty', 'clear']);
    const dataset = Array.from({ length: 500 }, (_, i) =>
      i % 3 === 0 ? '' : i % 3 === 1 ? 'team otw eta 90 menit' : 'team onsite ts'
    );

    const startMs = performance.now();
    const matched = dataset.filter((remark) => matchesRemarkClarityFilter(remark, 'unclear'));
    const elapsedMs = performance.now() - startMs;

    assert.equal(matched.length, 334);
    assert.ok(elapsedMs < 100, `Expected <100ms, got ${elapsedMs.toFixed(2)}ms`);
  });
});

