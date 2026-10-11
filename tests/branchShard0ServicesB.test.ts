import { describe, expect, it } from 'vitest';
import type { TopicalDiagnosisReport } from '@/services/topicalDiagnosis';
import { buildDiagnosisDocuments } from '@/services/topicalDiagnosis/documents';
import { importDiagnosisTopics } from '@/services/topicalDocument/diagnosisImport';
import { createEmptyTopicalMap } from '@/services/topicalMap';
import { matchParagraphToCrawlSource } from '@/services/briefDocument/evidence';
import { buildCrawlerReadiness } from '@/services/crawlerReadiness';
import { buildAmpAndTransportChecks } from '@/services/auditChecks/accessibilityAndContentChecks';
import { normalizePersistedProjects } from '@/stores/projectStore';
import { domainFromInput } from '@/components/SeoTools/workspace/seoToolsTypes';
import { createCrawlPageFixture, createCrawlResultFixture } from './fixtures/crawl';

describe('branch shard 0 services', () => {
  it('builds documents for a root url and an unparsable url without a language prefix', () => {
    const pages = [
      createCrawlPageFixture({ url: 'https://ex.test', final_url: 'https://ex.test', semantic_language: 'pl', semantic_terms: ['alfa'] }),
      createCrawlPageFixture({ url: 'not a url', final_url: 'not a url', semantic_language: 'pl', semantic_terms: ['beta'] }),
    ];
    const { documents } = buildDiagnosisDocuments(pages, 'https://unrelated.test/');
    expect(documents.map((document) => document.primaryPage.url)).toEqual(['https://ex.test', 'not a url']);
  });

  describe('importDiagnosisTopics', () => {
    const report = (documents: unknown[], topics: unknown[]) => ({ documents, topics }) as unknown as TopicalDiagnosisReport;
    const doc = (id: string, url: string, finalUrl: string) => ({ id, pages: [{ url, final_url: finalUrl }], primaryPage: { url, final_url: finalUrl } });
    it('falls back to the url for pathless, invalid and missing sources', () => {
      const topics = ['a', 'b', 'c'].map((id, index) => ({ id: `t${id}`, label: '', documentIds: [index === 2 ? 'ghost' : `d${id}`] }));
      const next = importDiagnosisTopics(
        createEmptyTopicalMap(),
        report([doc('da', 'foo://host', ''), doc('db', 'not a url', 'https://ex.test/final')], topics),
        'run-x', 'Temat',
      );
      expect(next.nodes.map((node) => node.title)).toEqual(['Temat · /', 'Temat · not a url', expect.stringMatching(/^Temat ·/)]);
      expect(next.nodes[0].sourceUrls).toEqual(['foo://host']);
      expect(next.nodes[1].sourceUrls).toEqual(['https://ex.test/final']);
      expect(next.nodes[2].sourceUrls).toEqual([]);
    });
  });

  it('describes a non-topical source page with and without a final url', () => {
    const base = { url: 'https://ex.test/gone', http_status: 404 };
    const withFinal = matchParagraphToCrawlSource('text', 'https://ex.test/gone', [createCrawlPageFixture({ ...base, final_url: 'https://ex.test/final' })]);
    expect(withFinal).toMatchObject({ matched: false, scope: 'no-signal', pageUrl: 'https://ex.test/final' });
    const withoutFinal = matchParagraphToCrawlSource('text', 'https://ex.test/gone', [createCrawlPageFixture({ ...base, final_url: '' })]);
    expect(withoutFinal).toMatchObject({ matched: false, scope: 'no-signal', pageUrl: 'https://ex.test/gone' });
  });

  it('treats a crawl without a pages array as empty', () => {
    const result = { ...createCrawlResultFixture(), pages: undefined } as unknown as ReturnType<typeof createCrawlResultFixture>;
    expect(buildCrawlerReadiness(result)).toMatchObject({ score: null, totalPages: 0, checks: [] });
  });

  it('falls back to the page url when an audit has no final url', () => {
    const checks = buildAmpAndTransportChecks({ url: 'https://plain.test/', final_url: '' } as never);
    expect(Array.isArray(checks)).toBe(true);
    expect(checks.length).toBeGreaterThan(0);
  });

  it('drops persisted projects whose name is not a string', () => {
    const projects = normalizePersistedProjects([{ id: 'p1', name: 42, rootUrl: 'https://ex.test' }, { id: 'p2', name: 'Valid', rootUrl: 'https://ex.test' }]);
    expect(projects.map((project) => project.id)).toEqual(['p2']);
  });

  it('rejects non-http schemes in domainFromInput', () => {
    expect(() => domainFromInput('ftp://example.com')).toThrow('invalid');
    expect(domainFromInput('https://www.Example.com')).toBe('example.com');
  });
});
