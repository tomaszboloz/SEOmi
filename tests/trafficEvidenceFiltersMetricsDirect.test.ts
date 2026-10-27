import { describe, expect, it } from 'vitest';
import {
  normalizeTrafficDate,
  normalizeTrafficDateRange,
  normalizeTrafficFilters,
  sameTrafficFilters,
  normalizeTrafficMetric,
} from '@/services/semanticGraph/trafficEvidenceNormalization';

describe('normalizeTrafficDate', () => {
  it('accepts valid ISO date strings', () => {
    expect(normalizeTrafficDate('2026-09-01')).toBe('2026-09-01');
  });

  it('rejects malformed, non-calendar and non-string dates', () => {
    expect(normalizeTrafficDate('2026-13-01')).toBeNull();
    expect(normalizeTrafficDate('09-01-2026')).toBeNull();
    expect(normalizeTrafficDate(null)).toBeNull();
    expect(normalizeTrafficDate(20260901)).toBeNull();
  });
});

describe('normalizeTrafficDateRange', () => {
  it('accepts valid range where start ≤ end', () => {
    const r = normalizeTrafficDateRange('2026-09-01', '2026-09-30');
    expect(r).toEqual({ startDate: '2026-09-01', endDate: '2026-09-30' });
  });

  it('rejects inverted boundary cases', () => {
    expect(normalizeTrafficDateRange('2026-09-30', '2026-09-01')).toBeNull();
  });

  it('accepts same start and end date', () => {
    expect(normalizeTrafficDateRange('2026-09-15', '2026-09-15')).toEqual({
      startDate: '2026-09-15', endDate: '2026-09-15',
    });
  });
});

describe('normalizeTrafficFilters', () => {
  it('returns empty object for null/undefined', () => {
    expect(normalizeTrafficFilters(null)).toEqual({});
    expect(normalizeTrafficFilters(undefined)).toEqual({});
  });

  it('accepts valid search_type, device and country', () => {
    const r = normalizeTrafficFilters({ search_type: 'web', device: 'MOBILE', country: 'POL' });
    expect(r).toEqual({ search_type: 'web', device: 'MOBILE', country: 'pol' });
  });

  it('rejects unknown search_type, device and bad country code', () => {
    expect(normalizeTrafficFilters({ search_type: 'unknown' })).toBeNull();
    expect(normalizeTrafficFilters({ device: 'WATCH' })).toBeNull();
    expect(normalizeTrafficFilters({ country: 'PL' })).toBeNull();
  });

  it('rejects arrays and primitives', () => {
    expect(normalizeTrafficFilters([])).toBeNull();
    expect(normalizeTrafficFilters('web')).toBeNull();
  });
});

describe('sameTrafficFilters', () => {
  it('matches equal filter objects', () => {
    expect(sameTrafficFilters({ search_type: 'web' }, { search_type: 'web' })).toBe(true);
    expect(sameTrafficFilters({}, {})).toBe(true);
  });

  it('detects differences', () => {
    expect(sameTrafficFilters({ device: 'MOBILE' }, { device: 'DESKTOP' })).toBe(false);
  });
});

describe('normalizeTrafficMetric', () => {
  it('accepts non-negative finite numbers including zero', () => {
    expect(normalizeTrafficMetric(0)).toBe(0);
    expect(normalizeTrafficMetric(42.5)).toBe(42.5);
  });

  it('rejects negative, infinite, NaN and non-numbers', () => {
    expect(normalizeTrafficMetric(-1)).toBeNull();
    expect(normalizeTrafficMetric(Infinity)).toBeNull();
    expect(normalizeTrafficMetric(NaN)).toBeNull();
    expect(normalizeTrafficMetric(null)).toBeNull();
    expect(normalizeTrafficMetric('0')).toBeNull();
  });
});
