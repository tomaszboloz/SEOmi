import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { generateAiText } from '@/services/ai/text';
import { buildTechnicalChecks } from '@/services/auditChecks/securityAndTechnicalChecks';
import { labelClusters, type Cluster } from '@/services/embeddings/cluster';
import { createProvider } from '@/services/embeddings/registry';
import { AUDIT_SCHEDULES_UPDATED_EVENT, loadScheduledAudits } from '@/services/auditSchedule';
import { saveScheduledAudits } from '@/services/schedules/persistence';
import { validateProjectRootUrl } from '@/services/projectValidation';
import { trafficPropertyMatchesUrl } from '@/services/semanticGraph/trafficEvidenceNormalization';
import { findInternalLinkOpportunities } from '@/services/internalLinkOpportunities';
import { buildSuggestionEvidence } from '@/services/freeSuggestions/suggestionEvidence';
import { buildTermStatistics } from '@/services/topicalDiagnosis/similarity';
import { areaLabel, buildAreas } from '@/services/topicalDiagnosis/areas';
import { topicVerdicts } from '@/services/topicalDiagnosis/verdicts/topics';
import type { VerdictContext } from '@/services/topicalDiagnosis/verdicts/context';
import type { DiagnosisDocument } from '@/services/topicalDiagnosis/types';
import type { DocumentLinkIndex } from '@/services/topicalDiagnosis/links';
import type { PageAuditData } from '@/types';
import { createCrawlPageFixture, createCrawlResultFixture, createCrawlRunFixture } from './fixtures/crawl';

beforeEach(() => localStorage.clear());
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it('falls back to the default Gemini model when none is configured', async () => {
  const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: 'ok' }] } }] })));
  await expect(generateAiText('gemini', 'key', '', 'hello')).resolves.toBe('ok');
  expect(String(fetchMock.mock.calls[0][0])).toMatch(/models\/gemini[^:]*:generateContent\?key=key$/);
});

it('treats a technical block without hreflang tags as having none', () => {
  const checks = buildTechnicalChecks({ technical: { content_type: 'text/html' } } as unknown as PageAuditData);
  expect(checks.find((check) => check.id === 'technical-hreflang')?.status).not.toBe('warning');
});

it('keeps a cluster unnamed when the generated label is empty', async () => {
  const cluster: Cluster = { members: [0], centroid: Float64Array.from([1]) as unknown as Cluster['centroid'] };
  const result = await labelClusters([cluster], ['alpha'], async () => '"  "');
  expect(result[0]).toBe(cluster);
  expect(result[0].label).toBeUndefined();
});

it('builds a local provider without fitting when no corpus is supplied', async () => {
  const provider = createProvider({ provider: 'local', dimensions: 16 });
  const [vector] = await provider.embed(['hello world']);
  expect(vector).toHaveLength(16);
});

it('returns no schedules for corrupt JSON and still saves when window is unavailable', () => {
  localStorage.setItem('seomi_project_proj-1_audit_schedules_v1', '{not json');
  expect(loadScheduledAudits('proj-1')).toEqual([]);
  const listener = vi.fn();
  window.addEventListener(AUDIT_SCHEDULES_UPDATED_EVENT, listener);
  vi.stubGlobal('window', undefined);
  expect(() => saveScheduledAudits('proj-1', [])).not.toThrow();
  vi.unstubAllGlobals();
  window.removeEventListener(AUDIT_SCHEDULES_UPDATED_EVENT, listener);
  expect(listener).not.toHaveBeenCalled();
  expect(localStorage.getItem('seomi_project_proj-1_audit_schedules_v1')).toBe('[]');
});

it('rejects IPv4-mapped IPv6 literals that point at private IPv4 ranges', () => {
  expect(validateProjectRootUrl('http://[::ffff:10.0.0.1]/').ok).toBe(false);
  expect(validateProjectRootUrl('http://[::ffff:8.8.8.8]/').ok).toBe(true);
});

it('matches a prefix traffic scope that carries no explicit port', () => {
  const scope = { kind: 'prefix', host: 'site.test', protocol: 'https:', prefix: '/blog', key: 'https://site.test/blog/' } as unknown as Parameters<typeof trafficPropertyMatchesUrl>[0];
  expect(trafficPropertyMatchesUrl(scope, 'https://site.test/blog/post')).toBe(true);
  expect(trafficPropertyMatchesUrl(scope, 'https://site.test:8443/blog/post')).toBe(false);
});

it('skips the requested-URL alias when the page url is not a valid http url', () => {
  const terms = ['alpha', 'beta', 'gamma'];
  const mk = (url: string, finalUrl: string) => createCrawlPageFixture({ url, final_url: finalUrl, semantic_terms: terms, semantic_links: [], indexability_status: 'Indexable', body_truncated: false, http_status: 200 });
  const report = findInternalLinkOpportunities([mk('not a url', 'https://a.test/one'), mk('https://a.test/two', 'https://a.test/two')]);
  expect(report.eligiblePageCount).toBeLessThanOrEqual(2);
});

it('uses the most recent completed run when several runs are valid', () => {
  const page = createCrawlPageFixture({ title: 'SEO audit', semantic_terms: ['seo', 'audit'], document_language: 'en', url: 'https://x.test/new', final_url: 'https://x.test/new' });
  const oldPage = createCrawlPageFixture({ title: 'SEO audit', semantic_terms: ['seo', 'audit'], document_language: 'en', url: 'https://x.test/old', final_url: 'https://x.test/old' });
  const run = (id: string, completedAt: string, p: typeof page) => createCrawlRunFixture({ id, projectId: 'pr', completedAt, result: createCrawlResultFixture({ pages: [p], pages_crawled: 1 }) });
  const report = buildSuggestionEvidence({ activeProjectId: 'pr', language: 'en', suggestions: ['seo audit'],
    runs: [run('a', '2026-01-01T00:00:00Z', oldPage), run('b', '2026-03-01T00:00:00Z', page), run('c', '2026-02-01T00:00:00Z', oldPage)] });
  expect(report.items[0].pages[0].url).toBe('https://x.test/new');
});

const doc = (id: string, role: DiagnosisDocument['role'], url: string, title = 'T', section = 's'): DiagnosisDocument => ({
  id, role, section, pages: [], primaryPage: createCrawlPageFixture({ url, title }), urls: new Set([url]), languages: ['pl'], terms: new Set(),
  titleTerms: new Set(), titleForms: new Map(), partialEvidence: false,
});

it('labels a hub with an opaque url as the root path and breaks area ties by document order', () => {
  expect(areaLabel(doc('doc-9', 'hub', 'custom://host', ''))).toBe('/');
  const hubA = doc('doc-0', 'hub', 'https://x.test/a/');
  const hubB = doc('doc-1', 'hub', 'https://x.test/b/');
  const page = doc('doc-2', 'content', 'https://x.test/p');
  const noOutgoing = doc('doc-3', 'hub', 'https://x.test/c/');
  const outgoing = new Map([['doc-0', new Set(['doc-2'])], ['doc-1', new Set(['doc-2'])]]);
  const links: DocumentLinkIndex = { outgoing, incoming: new Map(), linksTo: (s, t) => outgoing.get(s)?.has(t) ?? false };
  const { areaByDocument, areas } = buildAreas([hubA, hubB, page, noOutgoing], links);
  expect(areaByDocument.get('doc-2')).toBe('area-doc-0');
  expect(areas.find((area) => area.id === 'area-doc-3')?.documentIds).toEqual([]);
});

it('counts members missing from the area map as hub-less and falls back to raw title keys', () => {
  const left = doc('doc-0', 'content', 'https://x.test/a'); const right = doc('doc-1', 'content', 'https://x.test/b');
  left.titleTerms = new Set(['pl:a', 'pl:b', 'pl:c']); right.titleTerms = new Set(['pl:a', 'pl:b', 'pl:c']);
  const noLinks: DocumentLinkIndex = { outgoing: new Map(), incoming: new Map(), linksTo: () => false };
  const context = {
    byId: new Map([[left.id, left], [right.id, right]]), links: noLinks, areaByDocument: new Map(),
    topics: [{ id: 'topic-0', label: '', labelSource: 'none', documentIds: ['doc-0', 'doc-1'], areaIds: [] }],
    pairs: [{ left: 'doc-0', right: 'doc-1', similarity: 0.9, shared: [] }],
  } as unknown as VerdictContext;
  const verdicts = topicVerdicts(context);
  expect(verdicts.map((v) => v.code)).toEqual(expect.arrayContaining(['topic-no-hub', 'cannibalization-candidate']));
  const cannibal = verdicts.find((v) => v.code === 'cannibalization-candidate')!;
  expect(cannibal.evidence[1].params).toEqual({ titleTokens: 'pl:a, pl:b, pl:c' });
});

it('treats an unparsable hub url as depth zero when ranking tied area candidates', () => {
  const broken = doc('doc-0', 'hub', 'not a url');
  const deep = doc('doc-1', 'hub', 'https://x.test/a/b/c/');
  const page = doc('doc-2', 'content', 'https://x.test/p');
  const outgoing = new Map([['doc-0', new Set(['doc-2'])], ['doc-1', new Set(['doc-2'])]]);
  const links: DocumentLinkIndex = { outgoing, incoming: new Map(), linksTo: () => false };
  expect(buildAreas([broken, deep, page], links).areaByDocument.get('doc-2')).toBe('area-doc-1');
});

it('treats unseen term keys as fully topical with default idf on large sites', () => {
  const documents = Array.from({ length: 10 }, (_, index) => ({ ...doc(`doc-${index}`, 'content', `https://x.test/${index}`), terms: new Set(['pl:common']) }));
  const stats = buildTermStatistics(documents, new Set());
  expect(stats.isTopical('pl:common')).toBe(false);
  expect(stats.isTopical('pl:unseen')).toBe(true);
  expect(stats.idf('pl:unseen')).toBeCloseTo(Math.log(1 + 10));
});
