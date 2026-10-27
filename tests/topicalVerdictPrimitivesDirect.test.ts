import { describe, expect, it } from 'vitest';
import { createCrawlPageFixture } from './fixtures/crawl';
import type { DiagnosisDocument } from '@/services/topicalDiagnosis/types';
import { listingNeighbour } from '@/services/topicalDiagnosis/pagination';
import { topicalTerms, type TermStatistics } from '@/services/topicalDiagnosis/similarity';
import { buildVerdicts, type VerdictContext } from '@/services/topicalDiagnosis/verdicts';
import { documentVerdicts } from '@/services/topicalDiagnosis/verdicts/documents';
import { duplicateVerdicts } from '@/services/topicalDiagnosis/verdicts/duplicates';
import { hubVerdicts } from '@/services/topicalDiagnosis/verdicts/hubs';
import { sortVerdicts, urlOf, verdict } from '@/services/topicalDiagnosis/verdicts/context';

const page = (url: string, patch: Record<string, unknown> = {}) => createCrawlPageFixture({
  url, final_url: url, semantic_language: 'pl', semantic_terms: ['temat'], ...patch,
});

const document = (id: string, url: string, role: DiagnosisDocument['role'] = 'content', patch: Record<string, unknown> = {}): DiagnosisDocument => {
  const primaryPage = page(url, patch);
  return {
    id, pages: [primaryPage], primaryPage, urls: new Set([url]), languages: ['pl'],
    terms: new Set(['pl:temat']), titleTerms: new Set(), titleForms: new Map(), section: 'blog', role, partialEvidence: false,
  };
};

const linkIndex = (pairs: Array<[string, string]> = []) => {
  const outgoing = new Map<string, Set<string>>();
  const incoming = new Map<string, Set<string>>();
  pairs.forEach(([source, target]) => {
    outgoing.set(source, new Set([...(outgoing.get(source) ?? []), target]));
    incoming.set(target, new Set([...(incoming.get(target) ?? []), source]));
  });
  return { outgoing, incoming, linksTo: (source: string, target: string) => outgoing.get(source)?.has(target) ?? false };
};

const stats = (): TermStatistics => ({
  documentFrequency: new Map(), comparable: 1, isTopical: (key) => key === 'pl:topic', idf: () => 1,
});

const context = (documents: DiagnosisDocument[], patch: Partial<VerdictContext> = {}): VerdictContext => {
  const links = linkIndex();
  return {
    documents, byId: new Map(documents.map((item) => [item.id, item])), links, allLinks: links, contentLinks: true,
    areas: [], areaByDocument: new Map(), topics: [], topicByDocument: new Map(), pairs: [], stats: stats(),
    startUrl: 'https://example.test/', languages: ['pl'], ...patch,
  };
};

describe('direct topical diagnosis callable assertions', () => {
  it('classifies pagination neighbours and keeps only topical terms', () => {
    const current = page('https://example.test/blog/page/2/');
    expect(listingNeighbour(current, 'https://example.test/blog/page/3/')).toBe('https://example.test/blog/page/3/');
    expect(listingNeighbour(current, 'https://example.test/blog/post/')).toBeNull();
    expect([...topicalTerms({ terms: new Set(['pl:topic', 'pl:brand']) } as DiagnosisDocument, stats())]).toEqual(['pl:topic']);
  });

  it('asserts verdict identity, URL selection and severity ordering', () => {
    const item = document('doc-1', 'https://example.test/a/');
    expect(urlOf(item)).toBe('https://example.test/a/');
    const fix = verdict('document-orphan', 'fix', 'document', item.id, [item]);
    const good = verdict('area-healthy', 'good', 'area', 'area-1', [item]);
    expect(fix).toMatchObject({ id: 'document-orphan:doc-1', urls: ['https://example.test/a/'], confidence: 'moderate' });
    expect(sortVerdicts([good, fix]).map((entry) => entry.severity)).toEqual(['fix', 'good']);
  });

  it('reports orphan and missing language evidence through documentVerdicts', () => {
    const item = document('doc-1', 'https://example.test/a/');
    const result = documentVerdicts(context([item], { languages: ['en', 'pl'] }));
    expect(result.map((entry) => entry.code)).toEqual(['document-orphan', 'language-pair-missing']);
    expect(result[0].severity).toBe('fix');
  });

  it('reports duplicate documents and a healthy linked hub area', () => {
    const first = document('doc-1', 'https://example.test/a/', 'content', { content_hash: 'same' });
    const second = document('doc-2', 'https://example.test/b/', 'content', { content_hash: 'same' });
    expect(duplicateVerdicts(context([first, second])).map((entry) => entry.code)).toEqual(['near-duplicate']);
    const hub = document('doc-0', 'https://example.test/blog/', 'hub');
    const member = document('doc-3', 'https://example.test/blog/a/');
    const links = linkIndex([['doc-0', 'doc-3'], ['doc-3', 'doc-0']]);
    const area = { id: 'area-doc-0', hubId: 'doc-0', label: 'Blog', documentIds: ['doc-3'] };
    const linked = context([hub, member], {
      links, allLinks: links, areas: [area], areaByDocument: new Map([['doc-3', area.id]]),
      topicByDocument: new Map([['doc-3', 'topic-1']]),
    });
    expect(hubVerdicts(linked).map((entry) => entry.code)).toEqual(['area-healthy']);
    expect(buildVerdicts(context([first, second], { contentLinks: false })).map((entry) => entry.code)).toEqual(['near-duplicate']);
  });


});
