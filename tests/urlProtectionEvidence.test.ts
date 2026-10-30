import { describe, expect, it } from 'vitest';
import { ADVICE_CONDITIONS, DEFAULT_PRI_PARAMS, adviceFor, decideProtection } from '@/services/urlProtection';
import type { UrlTelemetry } from '@/services/urlTelemetry';

const miss = { state: 'unavailable', value: null } as const;
const gsc = (clicks: number) => ({ state: 'measured' as const, value: { clicks, impressions: 0, position: null, observedQueryCount: 0, queryCountTruncated: false } });
const ga4 = (keyEvents: number) => ({ state: 'measured' as const, value: { sessions: 0, engagedSessions: 0, keyEvents } });
const links = (referringDomains: number) => ({ state: 'measured' as const, value: { referringDomains } });
const tel = (over: Partial<UrlTelemetry> = {}): UrlTelemetry => ({ url: 'https://a.com/x', gsc: gsc(0), ga4: ga4(0), backlinks: links(0), revenue: miss, ...over });

describe('protection decision order (GEM-81-T01/T02)', () => {
  it('shields a low-TRS page with one conversion even when custom PRI params normalise it below the threshold', () => {
    const r = decideProtection(5, tel({ ga4: ga4(1) }), { priParams: { conversionsThreshold: 100 } });
    expect(r.pri.pri).toBeLessThan(0.15);
    expect(r).toMatchObject({ decision: 'shield', reasons: ['conversions'], automaticAction: false });
  });

  it('revenue without conversions and conversions without revenue both protect, in any currency', () => {
    for (const currency of ['PLN', 'EUR', 'JPY']) {
      expect(decideProtection(5, tel({ revenue: { state: 'measured', value: { amount: 3, currency } } })).reasons).toEqual(['revenue']);
    }
    expect(decideProtection(5, tel({ ga4: ga4(2), revenue: miss })).decision).toBe('shield');
  });

  it('clicks and referring domains shield through the PRI', () => {
    expect(decideProtection(5, tel({ gsc: gsc(200) })).reasons).toEqual(['pri-above-threshold']);
    expect(decideProtection(5, tel({ backlinks: links(15) })).pri.pri).toBe(1);
  });
});

describe('explicit parameters and inclusive thresholds (GEM-81-T03)', () => {
  it('records the parameters used and treats ties as protected', () => {
    const tie = decideProtection(40, tel());
    expect(tie.decision).toBe('keep');
    expect(tie.parameters).toEqual({ trsThreshold: 40, priThreshold: 0.15, priParams: DEFAULT_PRI_PARAMS, inclusive: true });
    // 30 clicks / (50 * 4) = 0.15 exactly.
    expect(decideProtection(39.9, tel({ gsc: gsc(30) })).decision).toBe('shield');
  });

  it('falls back to defaults for zero or invalid parameters and says so in the result', () => {
    const r = decideProtection(5, tel(), { trsThreshold: 0, priThreshold: Number.NaN, priParams: { clicksMultiplier: 0, domainsThreshold: -2 } });
    expect(r.parameters.trsThreshold).toBe(40);
    expect(r.parameters.priThreshold).toBe(0.15);
    expect(r.parameters.priParams).toMatchObject({ clicksMultiplier: 4, domainsThreshold: 5 });
  });
});

describe('evidence keeps unknown apart from measured zero (GEM-81-T04)', () => {
  it('lists every signal with state and raw value', () => {
    const r = decideProtection(5, tel({ gsc: miss, revenue: { state: 'measured', value: { amount: 9, currency: ' ' } } }));
    expect(r.decision).toBe('needs-data');
    expect(r.evidence.find((item) => item.signal === 'clicks')).toEqual({ signal: 'clicks', state: 'unavailable', value: null, norm: null });
    expect(r.evidence.find((item) => item.signal === 'conversions')).toEqual({ signal: 'conversions', state: 'measured', value: 0, norm: 0 });
    expect(r.evidence.find((item) => item.signal === 'revenue')).toEqual({ signal: 'revenue', state: 'measured', value: 9, norm: null });
  });

  it('a partial or stale window asks for data instead of pruning', () => {
    expect(decideProtection(5, tel({ gsc: { ...gsc(0), state: 'partial-history' } })).decision).toBe('needs-data');
    expect(decideProtection(5, tel({ backlinks: { ...links(0), state: 'stale' } })).advice).toEqual([{ code: 'check-gsc-ga4-backlinks-access', conditions: ['fresh-90-day-window'] }]);
  });

  it('keeps the revenue currency as reported', () => {
    const r = decideProtection(5, tel({ revenue: { state: 'measured', value: { amount: 4, currency: 'EUR' } } }));
    expect(r.evidence.at(-1)).toMatchObject({ value: 4, currency: 'EUR' });
  });
});

describe('advisory alternatives only (GEM-81-T05)', () => {
  it('a measured low-value page gets conditional, never executed, alternatives', () => {
    const r = decideProtection(5, tel());
    expect(r).toMatchObject({ decision: 'prune-candidate', automaticAction: false, requiresBusinessReview: true });
    const redirect = r.advice.find((item) => item.code === 'redirect-301-to-relevant-target');
    expect(redirect?.conditions).toContain('relevant-target-same-intent');
    expect(r.advice.find((item) => item.code === 'noindex-or-410-after-review')?.conditions).toContain('not-via-robots-txt');
  });

  it('every alternative carries at least one condition', () => {
    Object.values(ADVICE_CONDITIONS).forEach((conditions) => expect(conditions.length).toBeGreaterThan(0));
    expect(adviceFor([])).toEqual([]);
  });
});
