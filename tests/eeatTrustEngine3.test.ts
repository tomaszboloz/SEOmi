import { beforeEach, describe, expect, it } from 'vitest';
import { buildTrustJsonLd, buildTrustReport, prefillFromAuthor, readTrustHistory, recordTrust, TRUST_HISTORY_LIMIT, trustHistoryKey } from '@/services/eeatTrust';
import { NOW, START, diabetesFocus, diabetesPages, trustedArticle } from './eeatTrustFixtures';

const site = (mutate: (page: ReturnType<typeof diabetesPages>[number]) => ReturnType<typeof diabetesPages>[number]) => {
  const pages = diabetesPages().map((page) => (page.url.includes('/articles/') ? mutate(page) : page));
  return { pages, focus: diabetesFocus(pages) };
};

describe('JSON-LD generator', () => {
  const base = { personName: 'Dr Anna Nowak', organizationUrl: 'https://diabetes.test/', pageUrl: 'https://diabetes.test/articles/a', sameAs: ['https://orcid.org/0000-0000-0000-0001'] };

  it('builds a valid Person plus MedicalWebPage graph', () => {
    const result = buildTrustJsonLd({ ...base, category: 'health', jobTitle: 'Diabetologist', organizationName: 'Portal', organizationSameAs: ['https://www.wikidata.org/wiki/Q1'], dateModified: '2026-10-01', lastReviewed: '2026-10-02', personUrl: 'https://diabetes.test/authors/anna', asReviewer: true });
    expect(result.ok).toBe(true);
    const graph = (result.graph['@graph'] as Array<Record<string, unknown>>);
    expect(graph.map((item) => item['@type'])).toEqual(['Organization', 'Person', 'MedicalWebPage']);
    expect(graph[2].reviewedBy).toEqual({ '@id': 'https://diabetes.test/authors/anna#person' });
    expect(JSON.parse(result.text)['@context']).toBe('https://schema.org');
  });

  it('uses a plain page and author for non-medical content and drops invalid sameAs', () => {
    const result = buildTrustJsonLd({ ...base, sameAs: ['not a url', ' ', 'https://linkedin.com/in/anna'] });
    expect(result.issues).toEqual(['invalid-same-as']);
    expect(result.ok).toBe(true);
    const graph = (result.graph['@graph'] as Array<Record<string, any>>);
    expect(graph[1].sameAs).toEqual(['https://linkedin.com/in/anna']);
    expect(graph[2]['@type']).toBe('WebPage');
    expect(graph[2].author).toBeDefined();
    expect(graph[1]['@id']).toBe('https://diabetes.test/#dr-anna-nowak');
  });

  it('reports missing fields', () => {
    const result = buildTrustJsonLd({ personName: ' ', organizationUrl: 'nope', pageUrl: 'ftp://x', sameAs: [] });
    expect(result.ok).toBe(false);
    expect(result.issues).toEqual(['missing-name', 'invalid-organization-url', 'invalid-page-url']);
    expect(buildTrustJsonLd({ ...base, personName: '***' }).graph).toBeDefined();
  });

  it('prefills the form from a crawled author', () => {
    const report = buildTrustReport(site((page) => trustedArticle(page)).pages, diabetesFocus(), { now: NOW });
    const form = prefillFromAuthor(report.authors[0], report, START);
    expect(form).toMatchObject({ personName: 'Anna Nowak', jobTitle: 'Diabetes insulin specialist', organizationName: 'Diabetes Portal', category: 'health', personUrl: 'https://diabetes.test/authors/anna' });
    const generic = prefillFromAuthor({ ...report.authors[0], generic: true, id: 'urn:x', articleUrls: [] }, report, START);
    expect(generic).toMatchObject({ personName: '', personUrl: undefined, pageUrl: START });
  });
});

describe('trust history', () => {
  beforeEach(() => localStorage.clear());
  const report = buildTrustReport([], undefined, { now: NOW });

  it('stores one snapshot per run, bounded, and rejects bad projects', () => {
    expect(recordTrust(null, report, 'r1')).toEqual([]);
    expect(recordTrust('../x', report, 'r1')).toEqual([]);
    expect(readTrustHistory(undefined)).toEqual([]);
    recordTrust('proj1', report, 'r1');
    recordTrust('proj1', { ...report, score: 55 }, 'r1');
    expect(readTrustHistory('proj1')).toHaveLength(1);
    expect(readTrustHistory('proj1')[0].score).toBe(55);
    for (let i = 0; i < TRUST_HISTORY_LIMIT + 5; i += 1) recordTrust('proj1', report, `run${i}`);
    expect(readTrustHistory('proj1')).toHaveLength(TRUST_HISTORY_LIMIT);
  });

  it('drops malformed stored entries', () => {
    localStorage.setItem(trustHistoryKey('proj1'), JSON.stringify([null, 'x', { at: 1 }, { at: 'a', runId: 'r', score: 'n' }, { at: 'a', runId: 'r', score: 5, layers: { schemaGraph: 4, transparency: 'bad', other: 1 } }]));
    expect(readTrustHistory('proj1')).toEqual([{ at: 'a', runId: 'r', score: 5, layers: { schemaGraph: 4 } }]);
    localStorage.setItem(trustHistoryKey('proj1'), '{}');
    expect(readTrustHistory('proj1')).toEqual([]);
  });
});
