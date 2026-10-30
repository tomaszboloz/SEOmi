import { describe, expect, it } from 'vitest';
import {
  calibrate, crawlInput, labelMatrix, parseCalibrationManifest, rawTrs, renderCalibrationMarkdown, scaleOutcome, trsHistogram, type CalibrationSite,
} from '@/services/siteFocusCalibration';
import { buildSiteFocusReport, SFS_CONFIG_HASH, type PageFocus } from '@/services/siteFocus';
import { diabetesSite, multiTopicSite } from './siteFocusFixtures';

// Synthetic fixtures exercise the harness only; they are not calibration evidence (#52 GEM-52-D02).
const provenance = { source: 'synthetic test fixture', consent: true, crawledAt: '2026-10-30' };
const site = (id: string, kind: CalibrationSite['kind'], pages = diabetesSite(), extra: Partial<CalibrationSite> = {}): CalibrationSite =>
  ({ id, kind, startUrl: 'https://diabetes.test/', pages, provenance, inputSha256: 'a'.repeat(64), options: { language: 'en' }, ...extra });
const page = (url: string, trs: number, extra: Partial<PageFocus> = {}): PageFocus => ({
  url, type: 'article', weight: 1, trs, similarity: 50, keywordOverlap: 50, semanticDrift: 10, wordCount: 100, keywordsFound: [], offTopicKeywords: [],
  foreignClusters: [], alignment: [], status: 'strong', priority: 'low', playbook: 'C', ...extra,
});

describe('calibration metrics', () => {
  it('rebuilds raw TRS from the components for both modes', () => {
    expect(rawTrs({ similarity: 80, keywordOverlap: 50, semanticDrift: 10 }, 'semantic')).toBeCloseTo(0.4 + 0.15 - 0.02);
    expect(rawTrs({ similarity: 0, keywordOverlap: 80, semanticDrift: 20 }, 'lexical')).toBeCloseTo(0.6 - 0.05);
  });

  it('shows how SFS, band and groups move with the multiplier', () => {
    const pages = [page('https://a.test/1', 0), page('https://a.test/2', 0, { similarity: 10, keywordOverlap: 10, semanticDrift: 60 })];
    const low = scaleOutcome(pages, 'semantic', 100);
    const high = scaleOutcome(pages, 'semantic', 140);
    expect(high.sfs).toBeGreaterThan(low.sfs ?? 0);
    expect(low.groups['off-topic'] + low.groups.borderline + low.groups.strong).toBe(2);
    expect(scaleOutcome([page('https://a.test/x', 0, { skipped: 'no-content' })], 'semantic', 125)).toMatchObject({ sfs: null, band: null });
  });

  it('buckets content pages and ignores skipped and technical ones', () => {
    const histogram = trsHistogram([page('a', 5), page('b', 100), page('c', 55), page('d', 55, { type: 'technical' }), page('e', 55, { skipped: 'noindex' })]);
    expect(histogram).toEqual([1, 0, 0, 0, 0, 1, 0, 0, 0, 1]);
  });

  it('compares manual labels with TRS groups and lists false positives and negatives', () => {
    const pages = [page('https://a.test/on', 20), page('https://a.test/off/', 90), page('https://a.test/mid', 50)];
    const matrix = labelMatrix(pages, { 'https://a.test/on': 'on-topic', 'https://a.test/off': 'off-topic', 'https://a.test/mid': 'borderline', 'https://a.test/gone': 'on-topic' });
    expect(matrix).toMatchObject({ labelled: 3, agreementPct: 33.3, falseOffTopic: ['https://a.test/on'], missedOffTopic: ['https://a.test/off'], unmatchedLabels: ['https://a.test/gone'] });
    expect(matrix?.matrix['on-topic']['off-topic']).toBe(1);
    expect(labelMatrix(pages, undefined)).toBeNull();
  });
});

describe('calibration run', () => {
  it('rejects unconsented or empty inputs and refuses to call a small corpus sufficient', () => {
    const report = calibrate([
      site('niche', 'niche'), site('portal', 'multi-topic', multiTopicSite()),
      site('secret', 'ecommerce', diabetesSite(), { provenance: { ...provenance, consent: false } }),
      site('nosource', 'other', diabetesSite(), { provenance: { ...provenance, source: ' ' } }),
      site('empty', 'polysemy', []),
    ], { now: '2026-10-30T00:00:00Z' });
    expect(report.rejected).toEqual([{ id: 'secret', reason: 'no-consent' }, { id: 'nosource', reason: 'no-source' }, { id: 'empty', reason: 'no-pages' }]);
    expect(report.sites.map((item) => item.id)).toEqual(['niche', 'portal']);
    expect(report.sufficient).toBe(false);
    expect(report.missingKinds).toEqual(['offer-blog', 'ecommerce', 'polysemy']);
    expect(report.profile.configHash).toBe(SFS_CONFIG_HASH);
    const niche = report.sites[0];
    const direct = buildSiteFocusReport(diabetesSite(), 'https://diabetes.test/', { language: 'en', now: '2026-10-30T00:00:00Z' });
    expect(niche).toMatchObject({ sfs: direct.score, band: direct.band, scored: direct.pages.filter((p) => !p.skipped).length, inputSha256: 'a'.repeat(64) });
    expect(niche.scales.find((outcome) => outcome.scale === 125)?.band).toBe(direct.band);
    const markdown = renderCalibrationMarkdown(report);
    expect(markdown).toContain('Insufficient corpus');
    expect(markdown).toContain('secret (no-consent)');
    expect(markdown).toContain('niche: no manual labels.');
  });

  it('marks a corpus of three scored sites as sufficient and keeps unavailable sites as unknown', () => {
    const report = calibrate([site('a', 'niche'), site('b', 'offer-blog'), site('c', 'ecommerce'), site('d', 'other', [{ ...diabetesSite()[0], http_status: 500 }])]);
    expect(report.sufficient).toBe(true);
    expect(report.sites[3]).toMatchObject({ unavailable: true, sfs: null, band: null, confidence: null });
    expect(renderCalibrationMarkdown(report)).toContain('meets the minimum');
  });

  it('validates the manifest and both crawl file shapes', () => {
    expect(() => parseCalibrationManifest({ sites: [] })).toThrow(/Invalid calibration manifest/);
    const parsed = parseCalibrationManifest({ sites: [{ id: 'x', kind: 'niche', file: 'x.json', provenance }], scales: [100] });
    expect(parsed.sites[0].id).toBe('x');
    expect(crawlInput({ startUrl: 'https://a.test/', result: { pages: [{ url: 'u' }] } }).pages).toHaveLength(1);
    expect(crawlInput({ start_url: 'https://a.test/', pages: [] }).startUrl).toBe('https://a.test/');
    expect(() => crawlInput({ pages: [] })).toThrow(/startUrl/);
  });
});
