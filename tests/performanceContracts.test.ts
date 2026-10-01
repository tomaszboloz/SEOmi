import { beforeEach, describe, expect, it } from 'vitest';
import { parseCruxReport, parsePageSpeedReport } from '@/services/performanceContracts';
import { loadSession, storageKey } from '@/components/Performance/performanceSession';
import type { CruxReport, PageSpeedReport } from '@/services/pagespeed';

const lighthouse: PageSpeedReport = {
  source: 'Lighthouse', requestedUrl: 'https://example.com', finalUrl: 'https://example.com', strategy: 'mobile',
  fetchedAt: null, lighthouseVersion: null,
  categories: { performance: null, accessibility: 0, bestPractices: 100, seo: 50 },
  metrics: { lcp: { id: 'lcp', title: 'LCP', displayValue: null, numericValue: 0, score: null } },
  opportunities: [{ id: 'images', title: 'Images', description: '', displayValue: null, score: 0 }],
  fieldExperience: null, originExperience: {},
};
const crux: CruxReport = {
  source: 'CrUX', fetchedAt: '2026-10-01', target: 'https://example.com', scope: 'url', formFactor: 'PHONE', response: {},
};

beforeEach(() => localStorage.clear());

describe('performance runtime contracts', () => {
  it('preserves valid zero/null scores without manufacturing missing evidence', () => {
    expect(parsePageSpeedReport(lighthouse)).toEqual(lighthouse);
    expect(parseCruxReport(crux)).toEqual(crux);
    expect(parsePageSpeedReport({ ...lighthouse, touchTargetAudit: null, imageOptimizationAudits: [] }))
      .toMatchObject({ touchTargetAudit: null, imageOptimizationAudits: [] });
  });

  it.each([null, [], false, 'report', {}, { source: 'partial' }])('rejects non-report input %j', (value) => {
    expect(parsePageSpeedReport(value)).toBeNull();
    expect(parseCruxReport(value)).toBeNull();
  });

  it.each([false, '82', -1, 101, NaN, Infinity])('rejects invalid category score %j', (value) => {
    expect(parsePageSpeedReport({ ...lighthouse, categories: { ...lighthouse.categories, performance: value } })).toBeNull();
  });

  it.each([false, '', -1, NaN, Infinity])('rejects invalid metric value %j', (value) => {
    expect(parsePageSpeedReport({ ...lighthouse, metrics: { lcp: { ...lighthouse.metrics.lcp, numericValue: value } } })).toBeNull();
  });

  it.each([-0.01, 1.01, '0.5', false, Infinity])('rejects invalid Lighthouse audit score %j', (value) => {
    expect(parsePageSpeedReport({ ...lighthouse, opportunities: [{ ...lighthouse.opportunities[0], score: value }] })).toBeNull();
  });

  it.each([
    { ...crux, response: null }, { ...crux, response: [] }, { ...crux, scope: 'other' },
    { ...crux, formFactor: 'TV' }, { ...crux, fetchedAt: false }, { ...crux, target: {} },
  ])('rejects malformed CrUX report envelopes', (value) => expect(parseCruxReport(value)).toBeNull());

  it('leaves unknown CrUX evidence for the evidence validator without supplying fake percentiles', () => {
    const report = { ...crux, response: { record: { collectionPeriod: { firstDate: {} }, metrics: { lcp: { percentiles: { p75: false } } } } } };
    expect(parseCruxReport(report)).toEqual(report);
  });

  it.each([null, [], false, 'saved session', 23])('recovers safely from a non-object session %j', (saved) => {
    localStorage.setItem(storageKey('project'), JSON.stringify(saved));
    expect(loadSession('project', 'https://example.com').url).toBe('https://example.com');
    expect(loadSession('project', '').pageSpeed).toBeNull();
  });

  it('keeps valid reports independently of a damaged report and never changes other projects', () => {
    const raw = JSON.stringify({ url: 'https://example.com/path', pageSpeed: lighthouse, crux: { bad: 'report' } });
    localStorage.setItem(storageKey('project'), raw);
    expect(loadSession('project', '').pageSpeed).toEqual(lighthouse);
    expect(loadSession('project', '').crux).toBeNull();
    expect(loadSession('other-project', '').pageSpeed).toBeNull();
    expect(localStorage.getItem(storageKey('project'))).toBe(raw);
  });

  it('falls back to valid input choices for malformed fields and malformed JSON', () => {
    localStorage.setItem(storageKey('project'), JSON.stringify({ url: {}, strategy: true, scope: [], formFactor: {} }));
    expect(loadSession('project', 'default')).toMatchObject({ url: 'default', strategy: 'mobile', scope: 'url', formFactor: 'PHONE' });
    localStorage.setItem(storageKey('project'), '{bad json');
    expect(loadSession('project', 'default').url).toBe('default');
  });
});
