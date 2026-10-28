import { describe, expect, it } from 'vitest';
import { computePri, decideProtection, sanitizePriParams } from '@/services/urlProtection';
import type { UrlTelemetry } from '@/services/urlTelemetry';

const miss = { state: 'unavailable', value: null } as const;
const tel = (over: Partial<UrlTelemetry> = {}): UrlTelemetry => ({
  url: 'https://a.com/x', gsc: { state: 'measured', value: { clicks: 0, impressions: 0, position: null, observedQueryCount: 0, queryCountTruncated: false } },
  ga4: { state: 'measured', value: { sessions: 0, engagedSessions: 0, keyEvents: 0 } }, backlinks: { state: 'measured', value: { referringDomains: 0 } }, revenue: miss, ...over,
});

describe('PRI', () => {
  it('takes the max of known normalized signals', () => {
    const r = computePri(tel({ gsc: { state: 'measured', value: { clicks: 100, impressions: 1, position: 1, observedQueryCount: 1, queryCountTruncated: false } } }));
    expect(r.pri).toBe(0.5);
    expect(r.unknown).toEqual([]);
  });
  it('clamps to 1 and ignores unknown signals instead of treating them as zero', () => {
    const r = computePri(tel({ gsc: miss, ga4: miss, backlinks: { state: 'measured', value: { referringDomains: 99 } } }));
    expect(r.pri).toBe(1);
    expect(r.unknown).toEqual(['clicks', 'conversions']);
    expect(computePri(tel({ gsc: miss, ga4: miss, backlinks: miss })).pri).toBeNull();
  });
  it('sanitizes bad params', () => {
    expect(sanitizePriParams({ clicksThreshold: -1, domainsMultiplier: NaN, clicksMultiplier: 10 })).toMatchObject({ clicksThreshold: 50, domainsMultiplier: 3, clicksMultiplier: 10 });
    expect(sanitizePriParams().conversionsThreshold).toBe(1);
  });
});

describe('protection decision', () => {
  it('keeps pages above the TRS threshold', () => expect(decideProtection(60, tel()).decision).toBe('keep'));
  it('shields on revenue', () => {
    expect(decideProtection(10, tel({ revenue: { state: 'measured', value: { amount: 5, currency: 'PLN' } } })).reasons).toEqual(['revenue']);
    expect(decideProtection(10, tel({ revenue: { state: 'measured', value: { amount: 0, currency: 'PLN' } } })).decision).toBe('prune-candidate');
  });
  it('never prunes positive revenue that lacks a currency', () => {
    for (const currency of ['', '  ']) {
      const r = decideProtection(10, tel({ revenue: { state: 'measured', value: { amount: 12, currency } } }));
      expect(r).toMatchObject({ decision: 'needs-data', reasons: ['telemetry-incomplete'], requiresBusinessReview: true, automaticAction: false });
      expect(r.alternatives).toEqual(['confirm-revenue-currency']);
    }
    expect(decideProtection(10, tel({ revenue: { state: 'measured', value: { amount: 3, currency: 'EUR' } } })).decision).toBe('shield');
  });
  it('shields a conversion without revenue', () => {
    const r = decideProtection(10, tel({ ga4: { state: 'measured', value: { sessions: 1, engagedSessions: 1, keyEvents: 1 } } }));
    expect(r).toMatchObject({ decision: 'shield', reasons: ['pri-above-threshold'] });
  });
  it('shields on PRI', () => {
    const r = decideProtection(10, tel({ backlinks: { state: 'measured', value: { referringDomains: 5 } } }));
    expect(r).toMatchObject({ decision: 'shield', automaticAction: false });
  });
  it('asks for data when telemetry is missing, stale or sampled', () => {
    const r = decideProtection(10, tel({ gsc: { state: 'missing-permission', value: null } }));
    expect(r.decision).toBe('needs-data');
    expect(r.weakSignals.clicks).toBe('missing-permission');
    expect(decideProtection(10, tel({ ga4: { state: 'stale', value: { sessions: 0, engagedSessions: 0, keyEvents: 0 } } })).decision).toBe('needs-data');
  });
  it('flags prune candidates and semantic bridges for review only', () => {
    const p = decideProtection(10, tel(), { trsThreshold: 0, priThreshold: -1 });
    expect(p).toMatchObject({ decision: 'prune-candidate', requiresBusinessReview: true, automaticAction: false });
    expect(p.alternatives).toContain('redirect-301-to-relevant-target');
    const b = decideProtection(10, tel(), { relatedToCore: true });
    expect(b.decision).toBe('semantic-bridge');
    expect(b.alternatives[0]).toBe('link-to-pillar');
  });
});
