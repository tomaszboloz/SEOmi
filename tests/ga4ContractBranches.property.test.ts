import { describe, expect, it } from 'vitest';
import {
  parseGa4Discovery,
  parseGa4Properties,
  parseGa4Property,
  validateGa4DateRange,
} from '@/services/ga4/contracts';

const property = {
  name: 'properties/123',
  display_name: 'Site',
  stream_urls: ['https://site.test/'],
};
const discovery = {
  status: 'complete',
  property,
  account_pages: 1,
  stream_pages: 1,
  candidates_checked: 1,
  may_be_truncated: false,
};

describe('GA4 contract property and discovery branches', () => {
  it('accepts property containers and rejects malformed properties', () => {
    expect(parseGa4Property({ ...property, display_name: undefined, stream_urls: [' https://site.test/ ', 'https://site.test/'] })).toEqual({
      name: 'properties/123',
      display_name: null,
      stream_urls: ['https://site.test/'],
    });
    expect(parseGa4Property({ ...property, display_name: null }).display_name).toBeNull();
    for (const value of [null, [], 'property']) {
      expect(() => parseGa4Property(value)).toThrow(/property/);
    }
    for (const urls of [undefined, null, [''], ['https://ok.test/', 4]]) {
      expect(() => parseGa4Property({ ...property, stream_urls: urls })).toThrow(/stream URLs/);
    }
    for (const name of [undefined, ' ']) {
      expect(() => parseGa4Property({ ...property, name })).toThrow(/property name/);
    }
    expect(() => parseGa4Property({ ...property, display_name: 7 })).toThrow(/display name/);
  });

  it('accepts both properties response shapes and rejects malformed containers', () => {
    expect(parseGa4Properties([property])).toEqual([property]);
    expect(parseGa4Properties({ properties: [property] })).toEqual([property]);
    expect(parseGa4Properties({ properties: [] })).toEqual([]);
    for (const raw of [null, 'properties', {}, { properties: null }, { properties: {} }]) {
      expect(() => parseGa4Properties(raw)).toThrow(/properties response/);
    }
  });

  it('covers date format, calendar and ordering rejection branches', () => {
    const valid = { startDate: '2026-09-01', endDate: '2026-09-30' };
    expect(validateGa4DateRange(valid)).toBeNull();
    expect(validateGa4DateRange({ startDate: 'bad', endDate: valid.endDate })).toContain('invalid');
    expect(validateGa4DateRange({ startDate: '2026-13-01', endDate: valid.endDate })).toContain('invalid');
    expect(validateGa4DateRange({ startDate: '2026-02-30', endDate: valid.endDate })).toContain('invalid');
    expect(validateGa4DateRange({ startDate: valid.startDate, endDate: 'bad' })).toContain('invalid');
    expect(validateGa4DateRange({ startDate: '2026-10-01', endDate: '2026-09-30' })).toContain('invalid');
  });

  it('rejects malformed discovery records and invalid counters', () => {
    expect(parseGa4Discovery(discovery)).toEqual(discovery);
    expect(parseGa4Discovery({ ...discovery, property: null }).property).toBeNull();
    for (const raw of [null, [], {}, { ...discovery, may_be_truncated: undefined }]) {
      expect(() => parseGa4Discovery(raw)).toThrow(/discovery/);
    }
    expect(() => parseGa4Discovery({ ...discovery, account_pages: 1.5 })).toThrow(/account pages/);
    expect(() => parseGa4Discovery({ ...discovery, stream_pages: -1 })).toThrow(/stream pages/);
    expect(() => parseGa4Discovery({ ...discovery, candidates_checked: undefined })).toThrow(/candidate/);
    expect(() => parseGa4Discovery({ ...discovery, status: 'unknown' })).toThrow(/status/);
  });
});
