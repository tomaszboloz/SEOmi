import { describe, expect, it } from 'vitest';
import { templateInformationGain } from '@/services/templateGovernor/informationGain';
import type { TemplateCluster } from '@/services/templateGovernor/cluster';
import { contentDecay } from '@/services/topicalAuthorityMonitoring/alerts';
import { buildTopicalBenchmark } from '@/services/topicalAuthorityReference/benchmark';
import { buildTopics } from '@/services/topicalDiagnosis/topics';
import type { DiagnosisDocument } from '@/services/topicalDiagnosis/types';
import type { TermStatistics } from '@/services/topicalDiagnosis/similarity';
import { buildAuthorityReport, type CompetitorPages, type TopicalAuthorityReport } from '@/services/topicalAuthority';
import { createCrawlPageFixture } from './fixtures/crawl';
import { NOW, OWN_HOST, ownReport, ownSite, referenceTaxonomy } from './authorityFixtures';

describe('geminiGapBACKLOG: templateGovernor, alerts, benchmark, and topics', () => {
  it('calculates exact templateInformationGain and covers branch line 38', () => {
    const cluster: TemplateCluster = {
      pattern: '/products/*',
      pages: [
        { url: 'https://site.test/p1', text: 'common template text uniqueA' },
        { url: 'https://site.test/p2', text: 'common template text uniqueB' },
      ],
    };
    expect(templateInformationGain(cluster, 0.8)).toBe(0.25);

    const identical: TemplateCluster = {
      pattern: '/fixed/*',
      pages: [{ url: 'https://site.test/f1', text: 'same header' }, { url: 'https://site.test/f2', text: 'same header' }],
    };
    expect(templateInformationGain(identical, 0.8)).toBe(0);

    const unique: TemplateCluster = {
      pattern: '/unique/*',
      pages: [{ url: 'https://site.test/u1', text: 'apple' }, { url: 'https://site.test/u2', text: 'cherry' }],
    };
    expect(templateInformationGain(unique, 0.8)).toBe(1);
  });

  it('covers contentDecay pillarUrl ternary branch on line 27 with typed report', () => {
    const pages = ownSite();
    const taxonomy = referenceTaxonomy(pages)!;
    const base = buildAuthorityReport(pages, `https://${OWN_HOST}/`, ownReport(pages), { taxonomy, now: NOW });
    const report: TopicalAuthorityReport = {
      ...base,
      silo: {
        ...base.silo,
        audits: {
          withPillar: { ...base.silo.audits.pour, pillarUrl: 'https://site.test/pillar' },
          withoutPillar: { ...base.silo.audits.pour, pillarUrl: undefined },
        },
      },
      freshness: { ...base.freshness, stale: ['https://site.test/pillar'] },
      coverage: [{
        ...base.coverage[0],
        bestUrl: 'https://site.test/pillar',
        entitiesMissing: ['schema', 'author'],
      }],
    };
    expect(contentDecay(report)).toEqual([{ code: 'content-decay', params: { url: 'https://site.test/pillar', missing: 2 } }]);
    expect(contentDecay({ ...report, freshness: { ...report.freshness, stale: [] } })).toEqual([]);
  });

  it('covers buildTopicalBenchmark tie-breaker sort on line 24 and trailing pillars on line 31', () => {
    const pages = ownSite();
    const taxonomy = referenceTaxonomy(pages)!;
    const own = buildAuthorityReport(pages, `https://${OWN_HOST}/`, ownReport(pages), { taxonomy, now: NOW });
    const competitors: CompetitorPages[] = [
      { domain: 'beta-comp.test', pages: ownSite() },
      { domain: 'alpha-comp.test', pages: ownSite() },
    ];
    const weakOwn: TopicalAuthorityReport = {
      ...own, tas: own.tas,
      pillarCoverage: [
        { id: 'pour', label: 'Pour', subtopics: 1, coveragePct: 0, gaps: 1, shallow: 0 },
        { id: 'general', label: 'General', subtopics: 1, coveragePct: 10, gaps: 1, shallow: 0 },
      ],
    };
    const forward = buildTopicalBenchmark(weakOwn, OWN_HOST, competitors, taxonomy, NOW);
    const reversed = buildTopicalBenchmark(weakOwn, OWN_HOST, [competitors[1], competitors[0]], taxonomy, NOW);
    expect(forward?.rows.map((r) => r.domain)).toEqual(['alpha-comp.test', 'beta-comp.test', OWN_HOST]);
    expect(reversed?.rows.map((r) => r.domain)).toEqual(['alpha-comp.test', 'beta-comp.test', OWN_HOST]);
    expect(forward?.insights).toContainEqual({ code: 'trailing-pillars', params: { pillars: 'General, Pour' } });
  });

  it('covers buildTopics pair truncation on line 46 using typed diagnosis documents', () => {
    const fixturePage = createCrawlPageFixture({ url: 'https://site.test/p', final_url: 'https://site.test/p' });
    const documents: DiagnosisDocument[] = Array.from({ length: 501 }, (_, i) => ({
      id: `doc-${i}`, role: 'content', url: `https://site.test/p${i}`, finalUrl: `https://site.test/p${i}`,
      pages: [fixturePage], primaryPage: fixturePage, urls: new Set([`https://site.test/p${i}`]),
      languages: ['en'], terms: new Set(['term1', 'term2']), titleTerms: new Set(['en:term1']),
      titleForms: new Map([['en:term1', 'Term1']]), section: '(root)', partialEvidence: false,
    }));
    const stats: TermStatistics = {
      documentFrequency: new Map([['term1', 501], ['term2', 501]]),
      comparable: 501, isTopical: () => true, idf: () => 1,
    };
    const result = buildTopics(documents, new Map(), stats, () => 1);
    expect(result.truncated).toBe(true);
    expect(result.pairs.length).toBe(124_750);
    expect(result.topics.length).toBeGreaterThan(0);
    expect(result.singletons.length).toBe(0);
  });
});
