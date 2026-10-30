import { describe, expect, it } from 'vitest';
import type { CrawledPageSummary } from '@/types';
import { buildTrustReport } from '@/services/eeatTrust';
import { ISLAND_MULTIPLIER, islandPenalty, schemaScore } from '@/services/eeatTrust/schemaScore';
import { createCrawlPageFixture } from './fixtures/crawl';
import { diabetesFocus, diabetesPages, node, NOW, trustedArticle } from './eeatTrustFixtures';

const CLAIM = { now: NOW, scoringProfile: 'claim-backed-v1' } as const;
const page = (path: string, patch: Partial<CrawledPageSummary> = {}): CrawledPageSummary => createCrawlPageFixture({
  url: `https://firm.test${path}`, final_url: `https://firm.test${path}`, title: null, ...patch,
});

describe('S_sameAs role-weighted recall under claim-backed-v1 (#87 GEM-87-05)', () => {
  const pages = diabetesPages().map((item) => (item.url.includes('/articles/') ? trustedArticle(item) : item));
  const focus = diabetesFocus(pages);

  it('scores sameAs as .50 Rec(author) + .25 Rec(reviewer) + .25 Rec(publisher)', () => {
    const report = buildTrustReport(pages, focus, CLAIM);
    expect(report.roleRecall).toBeDefined();
    expect(report.layers.sameAs).toBe(Math.round((report.roleRecall ?? 0) * 100));
    // Author, reviewer: one ORCID (.45); publisher: one Wikidata (.45). Weighted mean stays .45.
    expect(report.layers.sameAs).toBe(45);
  });

  it('keeps the legacy sameAs layer untouched', () => {
    const legacy = buildTrustReport(pages, focus, { now: NOW });
    // Legacy: min(1, 2 links / 2 entities) * 50 + mean recall (.45 + 0 org) / 2 * 50.
    expect(legacy.layers.sameAs).toBe(61);
  });
});

describe('disconnected graph islands (#65 GEM-65-03)', () => {
  const audit = (islands: number, pagesAudited: number) => ({
    pagesAudited, islands: Array.from({ length: islands }, (_, index) => ({ page: `p${index}`, components: 2, nodes: 2 })),
  });

  it('multiplies by .65 when every audited page is split and scales by share otherwise', () => {
    expect(ISLAND_MULTIPLIER).toBe(0.65);
    expect(islandPenalty(80, audit(2, 2), 'claim-backed-v1')).toBe(52);
    expect(islandPenalty(80, audit(1, 2), 'claim-backed-v1')).toBe(66);
    expect(islandPenalty(80, audit(5, 2), 'claim-backed-v1')).toBe(52);
  });

  it('never penalizes legacy, unaudited or connected graphs', () => {
    expect(islandPenalty(80, audit(2, 2))).toBe(80);
    expect(islandPenalty(80, audit(0, 0), 'claim-backed-v1')).toBe(80);
    expect(islandPenalty(80, audit(0, 3), 'claim-backed-v1')).toBe(80);
  });

  it('applies the penalty to the schema layer of a crawled split graph', () => {
    const split = page('/a', { schema_references: [
      ...node('$.@graph[0]', { type: 'Article', props: [['datePublished', '2026-01-01']] }),
      ...node('$.@graph[1]', { id: 'https://firm.test/#org', type: 'Organization', name: 'Firm' }),
    ] });
    const report = buildTrustReport([split], undefined, CLAIM);
    expect(report.graphAudit?.islands).toHaveLength(1);
    const plain = schemaScore(report.schema, report.ymyl, 'claim-backed-v1');
    expect(report.layers.schemaGraph).toBe(Math.round(plain * ISLAND_MULTIPLIER));
    expect(report.layers.schemaGraph).toBeLessThan(plain);
  });
});

describe('non-medical company, no articles, partial crawl (#65 GEM-65-T03)', () => {
  const pages = [
    page('/', { title: 'Firm', schema_references: node('$', { id: 'https://firm.test/#org', type: 'Organization', name: 'Firm', props: [['sameAs', 'https://www.wikidata.org/wiki/Q42']] }) }),
    page('/kontakt', { title: 'Kontakt' }),
    page('/broken', { http_status: 500 }),
  ];

  it('reports unknown layers instead of zero and never invents a YMYL category', () => {
    for (const options of [{ now: NOW }, CLAIM]) {
      const report = buildTrustReport(pages, undefined, options);
      expect(report).toMatchObject({ articleCount: 0, pageCount: 2, availability: 'observed' });
      expect(report.ymyl).toBeUndefined();
      expect(report.ymylPolicy).toBeUndefined();
      expect(report.layers.authorAlignment).toBeUndefined();
      expect(report.layers.citationQuality).toBeUndefined();
      expect(report.score).not.toBeNull();
    }
  });

  it('leaves sameAs unknown under claim-backed-v1 when no author, reviewer or publisher is named', () => {
    expect(buildTrustReport(pages, undefined, { now: NOW }).layers.sameAs).toBe(50);
    const report = buildTrustReport(pages, undefined, CLAIM);
    expect(report.roleRecall).toBeUndefined();
    expect(report.layers.sameAs).toBeUndefined();
    expect(report.coverage?.sameAs?.unknown).toBe(100);
  });
});
