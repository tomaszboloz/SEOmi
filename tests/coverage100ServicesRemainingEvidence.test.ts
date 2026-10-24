import { describe, expect, it } from 'vitest';
import { estimateImpact } from '@/services/causalMarket/impact';
import { buildSuggestionEvidence } from '@/services/freeSuggestions/suggestionEvidence';
import { buildTrustReport } from '@/services/eeatTrust/build';
import { scanAuthors } from '@/services/eeatTrust/authors';
import { buildMetaAndIndexabilityChecks } from '@/services/auditChecks/httpAndMetaChecks';
import type { SchemaNode } from '@/services/eeatTrust/graph';
import { diabetesFocus, diabetesPages, trustedArticle, NOW } from './eeatTrustFixtures';
import { createCrawlPageFixture } from './fixtures/crawl';
import { createAuditFixture } from './fixtures/audit';

describe('remaining evidence service branches', () => {
  it('returns a zero relative effect when the expected post level is zero', () => {
    const dates = Array.from({ length: 8 }, (_, index) => `2026-01-${String(index + 1).padStart(2, '0')}`);
    const result = estimateImpact({ dates, test: [1, 2, 3, 4, 5, 6, 7, 1], control: [1, 2, 3, 4, 5, 6, 7, 0], market: null, interventionDate: dates[7], updateWindows: [] });
    expect(result?.relativeEffect).toBe(0);
  });

  it('uses the zero fallback for a missing reported page count', () => {
    const page = createCrawlPageFixture({ url: 'https://site.test/seo', final_url: 'https://site.test/seo', title: 'SEO audit', semantic_terms: ['seo', 'audit'], document_language: 'en' });
    let reads = 0;
    const result = { pages: [page], get pages_crawled() { return reads++ === 0 ? 1 : null; } };
    const run = { id: 'suggestion-null-count', projectId: 'suggestion-project', completedAt: NOW, result };
    const report = buildSuggestionEvidence({ activeProjectId: 'suggestion-project', language: 'en', suggestions: ['seo audit'], runs: [run] as never });
    expect(reads).toBeGreaterThan(1);
    expect(report.pagesConsidered).toBe(1);
    expect(report.pagesOmitted).toBe(0);
  });

  it('evaluates the canonical status fallback for a falsy observed code', () => {
    const audit = createAuditFixture();
    audit.indexability = { status: 'uncertain', reasons: [], canonical_target_checked: true, canonical_target_status: 0 };
    const check = buildMetaAndIndexabilityChecks(audit).find((item) => item.id === 'canonical-target-status');
    expect(check?.status).toBe('error');
    expect(check?.evidence).toBeTruthy();
  });

  it('uses the request URL for an author profile with no final URL', () => {
    const url = 'https://diabetes.test/article';
    const person: SchemaNode = { page: url, decl: 0, path: '$.author', id: 'person-id', types: ['Person'], props: { url: ['https://diabetes.test/profile'], jobTitle: ['Diabetes specialist'] } };
    const article: SchemaNode = { page: url, decl: 0, path: '$', types: ['Article'], props: { author: ['person-id'] } };
    const profile = { ...diabetesPages()[0], url: 'https://diabetes.test/profile', final_url: '', focus_terms: [{ term: 'diabetes', surface: 'diabetes', count: 1, weight: 2 }] };
    const found = scanAuthors([profile], new Map([[url, [article, person]]]), new Map([[url, [article]]]), new Map([['person-id', person]]), diabetesFocus());
    expect(found.authors[0]?.alignmentPct).toBeDefined();
  });

  it('uses the article request URL when final_url is empty', () => {
    const page = trustedArticle(diabetesPages().find((item) => item.url.includes('/articles/'))!);
    const input = { ...page, final_url: '' };
    expect(input.final_url).toBe('');
    const report = buildTrustReport([input], diabetesFocus(), { now: NOW });
    expect(report.pageCount).toBe(1);
    expect(report.articleCount).toBe(1);
  });
});
