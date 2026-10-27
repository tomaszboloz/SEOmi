import { afterEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/i18n';
import { SiteCrawlResultSchema } from '@/services/contracts/crawl/crawlResult';
import { localizeCrawlIssue } from '@/services/crawlIssueLocalization';
import { auditHtml, crawlReportHtml } from '@/services/export/html';
import { readStorageEntries } from '@/services/storage';
import { buildDiagnosisDocuments } from '@/services/topicalDiagnosis/documents';
import { topicLabel } from '@/services/topicalDiagnosis/labels';
import { buildTermStatistics } from '@/services/topicalDiagnosis/similarity';
import { contentDocuments, documentIndex, type VerdictContext } from '@/services/topicalDiagnosis/verdicts/context';
import type { CrawledPageIssue } from '@/types';
import { createAuditFixture } from './fixtures/audit';
import { createCrawlPageFixture, createCrawlRunFixture } from './fixtures/crawl';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('crawl result contract nullable robots fields', () => {
  it('maps null robots evaluation status and redirect chain to undefined', () => {
    const base = createCrawlRunFixture().result;
    const parsed = SiteCrawlResultSchema.parse({
      ...base,
      robots_txt_evaluation_status: null,
      robots_txt_redirect_chain: null,
    });
    expect(parsed.robots_txt_evaluation_status).toBeUndefined();
    expect(parsed.robots_txt_redirect_chain).toBeUndefined();
  });
});

describe('crawl issue localization for code-mapped issues', () => {
  it('translates a coded issue without parameters and keeps the raw message as default', () => {
    const t = vi.fn((key: string, options?: Record<string, unknown>) => `${key}|${JSON.stringify(options)}`);
    const issue = { severity: 'Warning', category: 'Content', code: 'crawl-missing-language', message: 'raw message', recommendation: '' } as unknown as CrawledPageIssue;
    const localized = localizeCrawlIssue(issue, t as unknown as Parameters<typeof localizeCrawlIssue>[1]);
    expect(t).toHaveBeenCalledWith('crawlIssues.missingLanguage', { defaultValue: 'raw message' });
    expect(localized.displayMessage).toBe('crawlIssues.missingLanguage|{"defaultValue":"raw message"}');
    expect(localized.message).toBe('raw message');
  });
});

describe('export html fallbacks', () => {
  it('uses the default language when no document exists', () => {
    vi.stubGlobal('document', undefined);
    const html = auditHtml(createAuditFixture());
    vi.unstubAllGlobals();
    expect(html).toContain('<html lang="en">');
  });

  it('renders an empty cell when the unknown-value translation is missing', () => {
    const original = i18n.t.bind(i18n);
    vi.spyOn(i18n, 't').mockImplementation(((key: string, ...rest: unknown[]) =>
      key === 'exportUi.html.unknown' ? undefined : (original as unknown as (...args: unknown[]) => unknown)(key, ...rest)) as unknown as typeof i18n.t);
    const html = auditHtml(createAuditFixture({ http_status: undefined as unknown as number }));
    expect(html).toContain('<td></td>');
  });

  it('falls back to the payload result when the stored run omits limitation flags', () => {
    const run = createCrawlRunFixture();
    const result = { ...run.result } as Record<string, unknown>;
    delete result.cancelled;
    const html = crawlReportHtml({ ...run, result: result as unknown as typeof run.result });
    expect(html).toContain('<th scope="row">cancelled</th>');
  });
});

describe('storage enumeration with vanished entries', () => {
  it('skips keys whose value disappears during enumeration', () => {
    localStorage.setItem('shard1:a', '1');
    vi.spyOn(Storage.prototype, 'getItem').mockReturnValue(null);
    expect(readStorageEntries('shard1:')).toEqual({});
  });
});

describe('topic label tie-breaks and frequency fallbacks', () => {
  const docs = (count: number, prefix: string) => buildDiagnosisDocuments(
    Array.from({ length: count }, (_, index) => createCrawlPageFixture({
      url: `https://example.test/${prefix}${index}`, final_url: `https://example.test/${prefix}${index}`, title: '', semantic_language: 'pl', semantic_terms: [],
    })),
    'https://example.test/',
  ).documents;

  it('orders equally scored title tokens that the first member lacks alphabetically', () => {
    const members = docs(3, 'm');
    members[0].titleTerms = new Set();
    for (const doc of members.slice(1)) {
      doc.titleTerms = new Set(['pl:beta', 'pl:alfa']);
      doc.titleForms = new Map([['pl:beta', 'beta'], ['pl:alfa', 'alfa']]);
    }
    expect(topicLabel(members, members, buildTermStatistics(members, new Set()))).toEqual({ label: 'alfa beta', source: 'title' });
  });

  it('treats tokens absent from the corpus as unique and not site-wide', () => {
    const members = docs(2, 'm');
    for (const doc of members) {
      doc.titleTerms = new Set(['pl:orbita', 'pl:ksiezyc']);
      doc.titleForms = new Map([['pl:orbita', 'orbita'], ['pl:ksiezyc', 'ksiezyc']]);
    }
    const corpus = docs(10, 'c');
    expect(topicLabel(members, corpus, buildTermStatistics(corpus, new Set()))).toEqual({ label: 'orbita ksiezyc', source: 'title' });
  });
});

describe('verdict context helpers', () => {
  it('keeps only content documents', () => {
    const [content, other] = buildDiagnosisDocuments([
      createCrawlPageFixture({ url: 'https://example.test/a', final_url: 'https://example.test/a' }),
      createCrawlPageFixture({ url: 'https://example.test/b', final_url: 'https://example.test/b' }),
    ], 'https://example.test/').documents;
    content.role = 'content';
    other.role = 'navigation' as typeof other.role;
    const context = { documents: [content, other] } as unknown as VerdictContext;
    expect(contentDocuments(context)).toEqual([content]);
  });

  it('derives the numeric index from a document id', () => {
    expect(documentIndex('doc-12')).toBe(12);
  });
});
