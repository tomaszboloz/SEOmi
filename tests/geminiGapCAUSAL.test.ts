import { describe, expect, it } from 'vitest';
import { scanAuthors } from '@/services/eeatTrust/authors';
import { buildTrustReport } from '@/services/eeatTrust/build';
import { buildFindings } from '@/services/eeatTrust/findings';
import { joinGa4Evidence } from '@/services/ga4/join';
import { hostOf } from '@/services/indexabilityGate/classify';
import { checkAlt } from '@/services/multimodal/altCheck';
import type { SchemaNode } from '@/services/eeatTrust/graph';
import type { CrawledPageSummary } from '@/types';
import type { Ga4Report } from '@/types/ga4';

describe('geminiGapCAUSAL targeted branch coverage', () => {
  it('covers eeatTrust/authors.ts line 74 name fallback branches with stable fixtures', () => {
    const namedNode: SchemaNode = { page: 'https://site.test/p1', decl: 0, path: '$', id: 'https://site.test/#named', types: ['Person'], name: 'Dr. Jane', props: {} };
    const idOnlyNode: SchemaNode = { page: 'https://site.test/p1', decl: 0, path: '$', id: 'https://site.test/#idonly', types: ['Person'], name: undefined, props: {} };
    const article: SchemaNode = { page: 'https://site.test/p1', decl: 0, path: '$', types: ['Article'], props: { author: ['https://site.test/#named', 'https://site.test/#idonly'] } };
    const registry = new Map([['https://site.test/#named', namedNode], ['https://site.test/#idonly', idOnlyNode]]);
    const scan = scanAuthors([], new Map(), new Map([['https://site.test/p1', [article]]]), registry, undefined);
    expect(scan.authors.find((a) => a.key === 'https://site.test/#named')?.name).toBe('Dr. Jane');
    expect(scan.authors.find((a) => a.key === 'https://site.test/#idonly')?.name).toBe('https://site.test/#idonly');
  });

  it('covers eeatTrust/build.ts lines 34-35 own and typed article branches with stable crawled pages', () => {
    const page1 = { url: 'https://site.test/art', final_url: 'https://site.test/art', http_status: 200, links: [], schema_references: [{ declaration_index: 0, format: 'JSON-LD', property: '@type', value: 'BlogPosting' }] } as unknown as CrawledPageSummary;
    const page2 = { url: 'https://site.test/other', final_url: 'https://site.test/other', http_status: 200, links: [], schema_references: [{ declaration_index: 0, format: 'JSON-LD', property: '@type', value: 'WebPage' }] } as unknown as CrawledPageSummary;
    const page3 = { url: 'https://site.test/plain', final_url: 'https://site.test/plain', http_status: 200, links: [], schema_references: [] } as unknown as CrawledPageSummary;
    const focus = { pages: [{ url: 'https://site.test/other', type: 'article' as const, skipped: undefined }], coreTopic: { label: 'General', terms: [] } } as never;
    const report = buildTrustReport([page1, page2, page3], focus);
    expect(report.schema.articleCount).toBe(2);
  });

  it('covers eeatTrust/findings.ts lines 19 and 52 pct and author alignment with stable fixtures', () => {
    const baseSchema = { articleCount: 10, articlesWithAuthor: 10, articlesWithReviewer: 1, organization: { present: true, name: 'Org', sameAs: ['https://org.test'] } };
    const citations = { pagesAnalyzed: 10, pagesWithTrusted: 2, deadLinks: ['https://dead.test/404'], scholarlySources: 0 } as never;
    const baseTransparency = { found: { editorial: true, contact: true, corrections: true, about: true, privacy: true, terms: true } } as never;
    const findings = buildFindings({
      schema: baseSchema as never,
      authors: [
        { name: 'Offtopic 1', generic: false, alignmentPct: 20, sameAs: ['https://x'], profiles: [], articleUrls: ['/p1'] } as never,
        { name: 'Ontopic 2', generic: false, alignmentPct: 80, sameAs: ['https://y'], profiles: [], articleUrls: ['/p2'] } as never,
      ],
      citations, transparency: baseTransparency, ymyl: 'health', unattributed: 2,
    });
    expect(findings.find((f) => f.code === 'ymyl-unattributed')?.params.pct).toBe(20);
    expect(findings.find((f) => f.code === 'low-citations')?.params.pct).toBe(20);
    expect(findings.find((f) => f.code === 'author-off-topic')?.params.pct).toBe(20);
    expect(findings.find((f) => f.params.name === 'Ontopic 2')).toBeUndefined();
  });

  it('covers ga4/join.ts lines 40, 46, 54 urlKey branches and fallbacks with stable records', () => {
    const report = { property: 'properties/123', start_date: '2026-01-01', end_date: '2026-01-31', rows: [
      { host_name: 'site.test', landing_page: '/valid', sessions: 100, engagement_rate: 0.8, conversions: 2, event_count: 10 },
      { host_name: 'site.test', landing_page: 'https://other.test/bad', sessions: 10, engagement_rate: 0.5, conversions: 0, event_count: 1 },
      { host_name: 'diff.test', landing_page: '/skip', sessions: 5, engagement_rate: 0.1, conversions: 0, event_count: 0 },
    ] } as unknown as Ga4Report;
    const gscData = { site_url: 'https://site.test/', start_date: '2026-01-01', end_date: '2026-01-31', pages: [
      { page: 'https://site.test/valid', clicks: 10, impressions: 100, ctr: 0.1, position: 2 },
      { page: 'https://other.test/foreign', clicks: 1, impressions: 1, ctr: 1, position: 1 },
      { page: 'https://site.test/valid', clicks: 5, impressions: 50, ctr: 0.1, position: 3 },
      { page: 'https://site.test/nan', clicks: Number.NaN, impressions: 1, ctr: 0, position: 1 },
    ] } as never;
    const crawlResult = { pages: [
      { url: 'https://site.test/valid', issues_count: 3 },
      { url: 'https://other.test/foreign', issues_count: 1 },
      { url: 'https://site.test/valid', issues_count: 3 },
      { url: 'https://site.test/negative', issues_count: -1 },
    ] } as never;
    const result = joinGa4Evidence({ report, gscData, crawlResult, projectRootUrl: 'https://site.test/' });
    expect(result.matched_gsc_rows).toBe(1);
    expect(result.matched_crawl_rows).toBe(1);
    expect(result.rows[0].gsc?.clicks).toBe(10);
    expect(result.rows[0].crawl_issue_count).toBe(3);
    const emptyJoin = joinGa4Evidence({ report, projectRootUrl: undefined });
    expect(emptyJoin.warnings).toContain('Project root URL is missing or invalid.');
  });

  it('covers indexabilityGate/classify.ts line 23 hostOf statement and catch branch with real strings', () => {
    expect(hostOf('https://EXAMPLE.test:8080/path')).toBe('example.test:8080');
    expect(hostOf('invalid-url-with-no-base')).toBeNull();
    expect(hostOf(':::')).toBeNull();
    expect(hostOf('')).toBeNull();
  });

  it('covers multimodal/altCheck.ts line 41 file extraction with real string inputs', () => {
    const verdict1 = checkAlt({ src: 'https://site.test/images/banner.jpg', alt: 'banner.jpg' });
    expect(verdict1.issues).toContain('filename');
    const verdict2 = checkAlt({ src: 'https://site.test/images/photo.png?w=200#hash', alt: 'Descriptive scenic view' });
    expect(verdict2.issues).not.toContain('filename');
    const verdict3 = checkAlt({ src: 'https://site.test/images/', alt: 'Generic trailing slash' });
    expect(verdict3.issues).not.toContain('filename');
    const verdict4 = checkAlt({ src: '', alt: 'Empty source string' });
    expect(verdict4.issues).not.toContain('filename');
    const verdict5 = checkAlt({ src: 'assets/icon.svg', alt: 'icon.svg' });
    expect(verdict5.issues).toContain('filename');
  });
});
