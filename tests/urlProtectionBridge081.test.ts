import { afterEach, describe, expect, it } from 'vitest';
import { buildSiteFocusReport, type PageFocus } from '@/services/siteFocus';
import { BRIDGE_MIN_CORE_TERMS, protectionRows, relatedToCore } from '@/services/urlProtection';
import { clearSnapshots, putSnapshot, type UrlTelemetrySnapshot } from '@/services/urlTelemetry';
import { DIABETES_TERMS, PHONE_TERMS, diabetesSite, makePage } from './siteFocusFixtures';

const START = 'https://diabetes.test/';
afterEach(clearSnapshots);

const found = (...counts: number[]): Pick<PageFocus, 'keywordsFound'> => ({ keywordsFound: counts.map((count, i) => ({ term: `t${i}`, count })) });

/** Every URL fully measured with zero value, so only the bridge check separates the decisions. */
const zeroSnapshot = (urls: string[]): UrlTelemetrySnapshot => ({
  id: 's', projectId: 'p1', origin: START, createdAt: '2026-10-15T00:00:00Z', expiresAt: '2999-01-01T00:00:00Z',
  sources: { gsc: { state: 'measured' }, ga4: { state: 'measured' }, backlinks: { state: 'measured' } },
  urls: urls.map((url) => ({
    url,
    gsc: { state: 'measured', value: { clicks: 0, impressions: 0, position: null, observedQueryCount: 0, queryCountTruncated: false } },
    ga4: { state: 'measured', value: { sessions: 0, engagedSessions: 0, keyEvents: 0 } },
    backlinks: { state: 'measured', value: { referringDomains: 0 } },
    revenue: { state: 'measured', value: { amount: 0, currency: 'EUR' } },
  })),
});

describe('semantic bridge needs a real thread to the Core (#81 GEM-81-06)', () => {
  it('counts only Core terms used at least twice, and needs three of them', () => {
    expect(BRIDGE_MIN_CORE_TERMS).toBe(3);
    expect(relatedToCore(found(2, 2, 5))).toBe(true);
    expect(relatedToCore(found(2, 2, 1, 1, 0))).toBe(false);
    expect(relatedToCore(found())).toBe(false);
  });

  it('offers a bridge for a measured low-value page that already uses Core terms, pruning review otherwise', () => {
    // A low-TRS page mixing phone content with a few diabetes words versus a pure phone page.
    const mixed = makePage('diabetes.test', {
      path: '/phones/diabetes-apps', title: 'Phone apps for glucose',
      terms: [...PHONE_TERMS.slice(0, 10).map((term): [string, number] => [term, 6]), ...DIABETES_TERMS.slice(0, 4).map((term): [string, number] => [term, 2])],
    });
    const report = buildSiteFocusReport([...diabetesSite(), mixed], START, { now: '2026-10-15T00:00:00Z' });
    const low = report.pages.filter((page) => !page.skipped && page.trs < 40);
    putSnapshot(zeroSnapshot(low.map((page) => page.url)));
    const rows = protectionRows(report, 'p1').rows;
    const decisionOf = (path: string) => rows.find((row) => row.url.endsWith(path))?.result.decision;
    const mixedPage = low.find((page) => page.url.endsWith('/phones/diabetes-apps'));
    expect(mixedPage).toBeDefined();
    expect(relatedToCore(mixedPage!)).toBe(true);
    expect(decisionOf('/phones/diabetes-apps')).toBe('semantic-bridge');
    expect(decisionOf('/phones/review-1')).toBe('prune-candidate');
    rows.forEach((row) => expect(row.result.automaticAction).toBe(false));
    expect(rows.find((row) => row.result.decision === 'semantic-bridge')?.result.alternatives[0]).toBe('link-to-pillar');
  });
});
