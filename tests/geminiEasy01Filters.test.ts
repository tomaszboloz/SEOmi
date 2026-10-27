import { describe, expect, it } from 'vitest';
import { filtersEqual, normalizedFilters } from '@/services/gscTracker/filters';
import type { GscPerformanceFilters } from '@/types';

describe('GSC filter normalization and equivalence', () => {
  it('normalizes undefined, empty, or whitespace-padded filter attributes', () => {
    expect(normalizedFilters(undefined)).toEqual({});
    expect(normalizedFilters({})).toEqual({});
    expect(normalizedFilters({ country: '   ' })).toEqual({});
    expect(normalizedFilters({ country: ' POL ', device: 'DESKTOP', search_type: 'web' })).toEqual({
      country: 'pol',
      device: 'DESKTOP',
      search_type: 'web',
    });
  });

  it('treats missing, empty, and equivalent country representations as equal', () => {
    expect(filtersEqual(undefined, undefined)).toBe(true);
    expect(filtersEqual(undefined, {})).toBe(true);
    expect(filtersEqual({}, { country: '  ' })).toBe(true);
    expect(filtersEqual({ country: ' USA ' }, { country: 'usa' })).toBe(true);
    expect(filtersEqual({ country: 'DEU' }, { country: 'deu' })).toBe(true);
    const left: GscPerformanceFilters = { search_type: 'web', device: 'MOBILE', country: ' GBR ' };
    const right: GscPerformanceFilters = { search_type: 'web', device: 'MOBILE', country: 'gbr' };
    expect(filtersEqual(left, right)).toBe(true);
  });

  it('treats filters with undefined properties as equivalent to omitted properties', () => {
    const sparse: GscPerformanceFilters = { search_type: 'web', device: undefined, country: undefined };
    const omitted: GscPerformanceFilters = { search_type: 'web' };
    expect(filtersEqual(sparse, omitted)).toBe(true);
  });

  it('distinguishes filters with different search types or presence', () => {
    expect(filtersEqual({ search_type: 'web' }, { search_type: 'image' })).toBe(false);
    expect(filtersEqual({ search_type: 'news' }, { search_type: 'discover' })).toBe(false);
    expect(filtersEqual({ search_type: 'web' }, {})).toBe(false);
    expect(filtersEqual(undefined, { search_type: 'web' })).toBe(false);
  });

  it('distinguishes filters with different devices or presence', () => {
    expect(filtersEqual({ device: 'DESKTOP' }, { device: 'MOBILE' })).toBe(false);
    expect(filtersEqual({ device: 'MOBILE' }, { device: 'TABLET' })).toBe(false);
    expect(filtersEqual({ device: 'DESKTOP' }, undefined)).toBe(false);
  });

  it('distinguishes filters with different countries or presence', () => {
    expect(filtersEqual({ country: 'pol' }, { country: 'deu' })).toBe(false);
    expect(filtersEqual({ country: 'fra' }, {})).toBe(false);
    expect(filtersEqual({}, { country: 'fra' })).toBe(false);
  });

  it('detects divergence when only one dimension differs among multiple set dimensions', () => {
    const base: GscPerformanceFilters = { search_type: 'web', device: 'MOBILE', country: 'pol' };
    expect(filtersEqual(base, { ...base, device: 'DESKTOP' })).toBe(false);
    expect(filtersEqual(base, { ...base, search_type: 'image' })).toBe(false);
    expect(filtersEqual(base, { ...base, country: 'esp' })).toBe(false);
  });
});
