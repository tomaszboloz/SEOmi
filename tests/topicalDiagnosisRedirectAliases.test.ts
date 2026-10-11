import { describe, expect, it } from 'vitest';
import { createCrawlPageFixture } from './fixtures/crawl';
import { buildTopicalDiagnosis } from '@/services/topicalDiagnosis';
import { indexDocumentLinks } from '@/services/topicalDiagnosis/links';

const link = (target_url: string) => ({ target_url, anchor_text: 'x', is_internal: true });
const page = (url: string, patch: Record<string, unknown> = {}) => createCrawlPageFixture({
  url, final_url: url, semantic_language: 'pl', word_count: 800, hreflangs: [], semantic_links: [], ...patch,
});
const codes = (report: ReturnType<typeof buildTopicalDiagnosis>) => report.verdicts.map((verdict) => verdict.code);
const urlsOf = (report: ReturnType<typeof buildTopicalDiagnosis>) => report.documents.map((document) => document.pages.map((member) => member.url));

describe('a redirect source crawled next to its target', () => {
  // `/old/` answers with the content of `/new/`; the crawler keeps both requests.
  const report = buildTopicalDiagnosis([
    page('https://ex.test/', { semantic_terms: ['start', 'oferta'], semantic_links: [link('https://ex.test/new/'), link('https://ex.test/x/')] }),
    page('https://ex.test/x/', { semantic_terms: ['kurs', 'online'], semantic_links: [link('https://ex.test/old/')] }),
    page('https://ex.test/old/', { final_url: 'https://ex.test/new/', semantic_terms: ['navigator', 'alerty'], content_hash: 'h1', title: 'Alerty' }),
    page('https://ex.test/new/', { semantic_terms: ['navigator', 'alerty'], content_hash: 'h1', title: 'Alerty' }),
  ], 'https://ex.test/');

  it('is one document led by the page that was not redirected', () => {
    expect(urlsOf(report)).toEqual([['https://ex.test/'], ['https://ex.test/x/'], ['https://ex.test/new/', 'https://ex.test/old/']]);
    expect(report.documents[2].primaryPage.url).toBe('https://ex.test/new/');
  });

  it('is neither an orphan nor a duplicate of itself', () => {
    expect(codes(report)).not.toContain('document-orphan');
    expect(codes(report)).not.toContain('near-duplicate');
    expect(report.stats.topics).toBe(0);
  });

  it('receives the links that point at either address', () => {
    const [home, other, target] = report.documents;
    const links = indexDocumentLinks(report.documents);

    expect(links.linksTo(home.id, target.id)).toBe(true);
    expect(links.linksTo(other.id, target.id)).toBe(true);
  });
});

describe('other aliases of one address', () => {
  it('folds a start URL that redirects to the canonical host into the home page', () => {
    const report = buildTopicalDiagnosis([
      page('http://ex.test/', { final_url: 'https://www.ex.test/', content_hash: 'hh', semantic_terms: ['start'] }),
      page('https://www.ex.test/a/', { semantic_terms: ['kurs'], semantic_links: [link('https://www.ex.test/')] }),
      page('https://www.ex.test/', { content_hash: 'hh', semantic_terms: ['start'], semantic_links: [link('https://www.ex.test/a/')] }),
    ], 'http://ex.test/');

    expect(urlsOf(report)).toEqual([['https://www.ex.test/a/'], ['https://www.ex.test/', 'http://ex.test/']]);
    expect(codes(report).filter((code) => code === 'document-orphan' || code === 'near-duplicate')).toEqual([]);
  });

  it('folds the same address requested with and without a trailing slash', () => {
    const report = buildTopicalDiagnosis([
      page('https://ex.test/', { semantic_terms: ['start'], semantic_links: [link('https://ex.test/oferta/')] }),
      page('https://ex.test/oferta', { semantic_terms: ['oferta', 'szkolenie'], content_hash: 'o1' }),
      page('https://ex.test/oferta/', { semantic_terms: ['oferta', 'szkolenie'], content_hash: 'o1' }),
    ], 'https://ex.test/');

    expect(urlsOf(report)).toEqual([['https://ex.test/'], ['https://ex.test/oferta', 'https://ex.test/oferta/']]);
    expect(codes(report).filter((code) => code === 'document-orphan' || code === 'near-duplicate')).toEqual([]);
  });

  it('leaves a redirect to an address outside the run a document of its own', () => {
    const report = buildTopicalDiagnosis([
      page('https://ex.test/', { semantic_terms: ['start'], semantic_links: [link('https://ex.test/old/')] }),
      page('https://ex.test/old/', { final_url: 'https://ex.test/elsewhere/', semantic_terms: ['kurs'] }),
    ], 'https://ex.test/');

    expect(report.stats.documents).toBe(2);
  });
});
