import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { shiftMonthKey } from '@/utils/dates';

/**
 * `shiftMonthKey` — the Home screen's month browsing.
 *
 * Built on the first of the month, so no case here needs special handling:
 * December plus one is January of the next year and January minus one is
 * December of the previous one, with no rollover branch of its own. Keys are
 * `YYYY-MM`, zero-padded on both parts, which is also what makes the bounds
 * comparisons in the Home switcher exact.
 */
describe('shiftMonthKey', () => {
  it('steps one month back within a year', () => {
    assert.equal(shiftMonthKey('2026-10', -1), '2026-09');
    assert.equal(shiftMonthKey('2026-01', -1), '2025-12');
  });

  it('steps one month forward within a year', () => {
    assert.equal(shiftMonthKey('2026-10', 1), '2026-11');
    assert.equal(shiftMonthKey('2026-12', 1), '2027-01');
  });

  it('returns the same month for a zero delta', () => {
    assert.equal(shiftMonthKey('2026-02', 0), '2026-02');
  });

  it('steps across a year boundary by more than one month', () => {
    assert.equal(shiftMonthKey('2026-10', -12), '2025-10');
    assert.equal(shiftMonthKey('2026-01', 14), '2027-03');
  });

  it('keeps the key shape across the step, so keys stay comparable as text', () => {
    assert.match(shiftMonthKey('2026-10', 2), /^\d{4}-(0[1-9]|1[0-2])$/);
  });
});