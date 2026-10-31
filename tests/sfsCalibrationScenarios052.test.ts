import { describe, expect, it } from 'vitest';
import { calibrate, CALIBRATION_KINDS, renderCalibrationMarkdown } from '@/services/siteFocusCalibration';
import { buildSiteFocusReport } from '@/services/siteFocus';
import { emptyCorpusSite, nicheSite, offerBlogSite, scenarioCorpus } from './sfsCalibrationScenarios';

const NOW = '2026-10-30T00:00:00Z';
const report = calibrate(scenarioCorpus(), { now: NOW });
const byId = (id: string) => report.sites.find((site) => site.id === id)!;

describe('SFS calibration scenarios (#52 GEM-52-T02/T03, synthetic)', () => {
  it('covers every corpus kind the issue asks for', () => {
    expect(report.rejected).toEqual([]);
    expect(report.missingKinds).toEqual([]);
    expect(new Set(report.sites.map((site) => site.kind))).toEqual(new Set(CALIBRATION_KINDS));
    expect(report.sufficient).toBe(true);
  });

  it('offer plus a large blog: anchors keep the offer as Core and every blog post off-topic', () => {
    const site = byId('offer-blog');
    expect(site.coreTopic.mode).toBe('anchored');
    expect(site.labels?.falseOffTopic).toEqual([]);
    expect(site.labels?.matrix['off-topic']['off-topic']).toBe(30);
    expect(site.labels?.agreementPct).toBeGreaterThan(90);
    // Without anchors the blog redefines the topic: the risk anchors exist for (#82 GEM-82-01).
    const unanchored = buildSiteFocusReport(offerBlogSite(), 'https://offer.test/', { language: 'en', now: NOW });
    expect(unanchored.coreTopic.mode).toBe('auto');
    expect(unanchored.coreTopic.label).not.toMatch(/repair|warranty|diagnostics|battery/);
  });

  it('polysemy: pages sharing the ambiguous word but not the sense are not missed', () => {
    const site = byId('jaguar');
    expect(site.coreTopic.label).not.toMatch(/rainforest|predator|habitat/);
    expect(site.labels?.missedOffTopic).toEqual([]);
    expect(site.labels?.falseOffTopic).toEqual([]);
    expect(site.labels?.matrix['off-topic']['off-topic']).toBe(4);
  });

  it('e-commerce with an off-topic section agrees with every manual label', () => {
    expect(byId('ecommerce').labels?.agreementPct).toBe(100);
  });

  it('small niche: technical pages are typed technical and the report is low confidence', () => {
    const niche = buildSiteFocusReport(nicheSite(), 'https://niche.test/', { language: 'en', now: NOW });
    expect(niche.flags.isLowConfidence).toBe(true);
    expect(niche.pages.filter((page) => page.type === 'technical').map((page) => new URL(page.url).pathname).sort()).toEqual(['/privacy-policy', '/terms']);
    expect(byId('niche').labels?.falseOffTopic).toEqual([]);
  });

  it('a raised TRS multiplier never lowers SFS on any scenario', () => {
    report.sites.forEach((site) => {
      const values = site.scales.map((outcome) => outcome.sfs ?? 0);
      values.slice(1).forEach((value, index) => expect(value).toBeGreaterThanOrEqual(values[index]));
    });
  });

  it('an empty corpus is unavailable, not a critical 0, and is still reported', () => {
    const empty = calibrate([{ id: 'empty', kind: 'other', startUrl: 'https://empty.test/', pages: emptyCorpusSite(), provenance: { source: 'synthetic', consent: true, crawledAt: '2026-10-30' } }], { now: NOW });
    expect(empty.sites[0]).toMatchObject({ unavailable: true, sfs: null, band: null, scored: 0, skipped: 5 });
    expect(empty.sufficient).toBe(false);
    expect(renderCalibrationMarkdown(empty)).toContain('empty');
  });
});
