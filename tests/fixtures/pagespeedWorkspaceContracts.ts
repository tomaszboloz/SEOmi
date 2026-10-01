import { CruxReport, PageSpeedReport } from '../../src/services/pagespeed';

export const project = { id: 'performance-project', name: 'Performance project', rootUrl: 'https://example.com/', createdAt: '2026-01-01T00:00:00.000Z', lastOpenedAt: '2026-01-01T00:00:00.000Z' };

export const otherProject = { id: 'other-performance-project', name: 'Other performance project', rootUrl: 'https://other.example/', createdAt: '2026-01-01T00:00:00.000Z', lastOpenedAt: '2026-01-01T00:00:00.000Z' };

export const psiFixture: PageSpeedReport = {
  source: 'Google PageSpeed Insights API / Lighthouse', requestedUrl: 'https://example.com/', finalUrl: 'https://example.com/', strategy: 'mobile', fetchedAt: '2026-09-22T10:00:00.000Z', lighthouseVersion: '12.0.0',
  categories: { performance: 82, accessibility: 100, bestPractices: 96, seo: 100 },
  metrics: { 'largest-contentful-paint': { id: 'largest-contentful-paint', title: 'LCP', displayValue: '2.3 s', numericValue: 2300, score: 0.75 } },
  touchTargetAudit: {
    id: 'target-size', title: 'Target size', description: 'Tap targets are too small or too close together.', score: 0,
    scoreDisplayMode: 'binary', displayValue: '1 target is too small',
    evidence: [{ label: 'Link', selector: 'a:nth-child(2)', snippet: '<a href="/">Link</a>', target: '24x24', targetSize: null, boundingRect: { width: 24, height: 24 }, failureSummary: 'Target is too small', explanation: null }],
    evidenceCount: 1, evidenceTruncated: false,
  },
  imageOptimizationAudits: [{
    id: 'modern-image-formats', title: 'Serve images in next-gen formats', description: 'Image formats can reduce transfer size.',
    score: 0, scoreDisplayMode: 'binary', displayValue: 'Potential savings of 42 KiB', overallSavingsBytes: 43008,
    evidence: [{ url: 'https://example.com/hero.jpg', label: 'Hero image', selector: 'img.hero', snippet: '<img class=hero>', totalBytes: 102400, wastedBytes: 43008, wastedPercent: 42, displayValue: null }],
    evidenceCount: 1, evidenceTruncated: false,
  }],
  opportunities: [], fieldExperience: null, originExperience: null,
};

export const cruxFixture: CruxReport = {
  source: 'Chrome UX Report API (CrUX)', fetchedAt: '2026-09-22T10:01:00.000Z', target: 'https://example.com/', scope: 'url', formFactor: 'PHONE',
  response: { record: { key: { url: 'https://example.com/' }, collectionPeriod: { firstDate: { year: 2026, month: 8, day: 26 }, lastDate: { year: 2026, month: 9, day: 22 } }, metrics: { largest_contentful_paint: { category: 'FAST', percentiles: { p75: 2100 }, histogram: [{ density: 0.75 }, { density: 0.2 }, { density: 0.05 }] } } } },
};
