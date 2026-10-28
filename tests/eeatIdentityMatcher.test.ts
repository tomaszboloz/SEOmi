import { beforeEach, describe, expect, it } from 'vitest';
import type { CrawledPageSummary } from '@/types';
import { bodyNames, defaultIdentityMatcher, nameTokens, sameName } from '@/services/eeatTrust/identityMatch';
import { clearRegistryCache, verifyProfile, type RegistryFetcher } from '@/services/eeatTrust/registry';
import { scanAuthors } from '@/services/eeatTrust/authors';
import type { SiteFocusReport } from '@/services/siteFocus';
import type { SchemaNode } from '@/services/eeatTrust/graph';
import type { ProfileEvidence } from '@/services/eeatTrust';

const orcid = (subjects?: string[]): ProfileEvidence => ({ url: 'https://orcid.org/0000-0002-1825-0097', kind: 'orcid', tier: 1, id: '0000-0002-1825-0097', status: 'syntax-valid', subjects });
const wikidata = (subjects?: string[]): ProfileEvidence => ({ url: 'https://www.wikidata.org/wiki/Q42', kind: 'wikidata', tier: 1, id: 'Q42', status: 'syntax-valid', subjects });
const orcidJson = (given: string, family: string, other: string[] = []) => JSON.stringify({ name: { 'given-names': { value: given }, 'family-name': { value: family } }, 'other-names': { 'other-name': other.map((value) => ({ content: value, value })) } });
const wikidataJson = (labels: string[], aliases: string[] = [], ids = ['Q42']) => JSON.stringify({ entities: Object.fromEntries(ids.map((id) => [id, { labels: Object.fromEntries(labels.map((value, i) => [`l${i}`, { value }])), aliases: { en: aliases.map((value) => ({ value })) } }])) });
const serve = (body: string): RegistryFetcher => async (url) => ({ status: 200, url, body });

describe('default identity matcher (#87)', () => {
  beforeEach(() => clearRegistryCache());

  it('folds diacritics, case, honorifics and order without breaking non-Latin scripts', () => {
    expect(nameTokens('Dr. Łukasz Żółciński')).toEqual(['lukasz', 'zolcinski']);
    expect(sameName('Michał Żółciński', 'ZOLCINSKI, Michal')).toBe(true);
    expect(sameName('Anna Maria Nowak', 'Anna Nowak')).toBe(true);
    expect(sameName('Иван Петров', 'Петров Иван')).toBe(true);
    expect(sameName('Иван Петров', 'Иван Сидоров')).toBe(false);
    expect(sameName('Anna', 'Anna')).toBe(false);
  });

  it('extracts names from ORCID JSON, Wikidata JSON and HTML, and refuses ambiguous bodies', () => {
    expect(bodyNames(orcidJson('Anna', 'Nowak', ['A. Nowak']))).toContain('Anna Nowak');
    expect(bodyNames(wikidataJson(['Jan Kowalski'], ['J. Kowalski']))).toEqual(['Jan Kowalski', 'J. Kowalski']);
    expect(bodyNames(wikidataJson(['A B'], [], ['Q1', 'Q2']))).toEqual([]);
    expect(bodyNames('<html><title>Anna Nowak - ORCID</title><h1>Anna &amp; Nowak</h1><script type="application/ld+json">{"name":"Anna Nowak","alternateName":"A. Nowak"}</script></html>')).toEqual(['Anna Nowak', 'Anna & Nowak', 'A. Nowak']);
    expect(bodyNames('<p>nothing</p>')).toEqual([]);
    expect(bodyNames('null')).toEqual([]);
  });

  it('decides only with a usable subject and a body that names someone', () => {
    expect(defaultIdentityMatcher(orcid(), { body: orcidJson('Anna', 'Nowak') })).toBeUndefined();
    expect(defaultIdentityMatcher(orcid(['Anna']), { body: orcidJson('Anna', 'Nowak') })).toBeUndefined();
    expect(defaultIdentityMatcher(orcid(['Anna Nowak']), { body: '<p></p>' })).toBeUndefined();
    expect(defaultIdentityMatcher({ ...orcid(['Anna Nowak']), kind: 'register' }, { body: orcidJson('Anna', 'Nowak') })).toBeUndefined();
    expect(defaultIdentityMatcher(orcid(['Anna Nowak']), { body: orcidJson('Anna', 'Nowak') })).toBe(true);
    expect(defaultIdentityMatcher(orcid(['Jan Kowalski']), { body: orcidJson('Anna', 'Nowak') })).toBe(false);
  });

  it('reaches verified, mismatch and fetched through verifyProfile with no custom matcher', async () => {
    expect((await verifyProfile(orcid(['Dr Anna Nowak']), { fetcher: serve(orcidJson('Anna', 'Nowak')) })).profile.status).toBe('verified');
    expect((await verifyProfile(wikidata(['Jan K.', 'Jan Kowalski']), { fetcher: serve(wikidataJson(['Jan Kowalski'])) })).profile.status).toBe('verified');
    expect((await verifyProfile(wikidata(['Anna Nowak']), { fetcher: serve(wikidataJson(['Jan Kowalski'])) })).profile.status).toBe('mismatch');
    expect((await verifyProfile(orcid(), { fetcher: serve(orcidJson('Anna', 'Nowak')) })).profile.status).toBe('fetched');
  });

  it('does not share cache between different subjects of the same URL', async () => {
    const fetcher = serve(orcidJson('Anna', 'Nowak'));
    const options = { fetcher };
    expect((await verifyProfile(orcid(['Anna Nowak']), options)).profile.status).toBe('verified');
    expect((await verifyProfile(orcid(['Jan Kowalski']), options)).profile.status).toBe('mismatch');
  });

  it('keeps a caller supplied matcher in charge', async () => {
    const result = await verifyProfile(orcid(['Anna Nowak']), { fetcher: serve(orcidJson('Anna', 'Nowak')), matches: () => false });
    expect(result.profile.status).toBe('mismatch');
  });
});

describe('scanAuthors identity subjects and author-page alignment (#87, #109)', () => {
  const page = (url: string, extra: object = {}) => ({ url, final_url: url, http_status: 200, title: url, schema_references: [], ...extra }) as unknown as CrawledPageSummary;
  const node = (props: Record<string, string[]>, id?: string, name?: string, types = ['Person']): SchemaNode => ({ page: 'https://s.test/a', decl: 0, path: '$', types, props, id, name });
  const report = { model: { language: 'en', coreWeights: { diabetes: 1, insulin: 1 } } } as unknown as SiteFocusReport;
  const article = node({ author: ['Anna Nowak'] }, undefined, undefined, ['Article']);
  const run = (pages: CrawledPageSummary[], rep: SiteFocusReport | undefined = report) =>
    scanAuthors(pages, new Map([['https://s.test/a', [article]]]), new Map([['https://s.test/a', [article]]]), new Map(), rep).authors[0];

  it('attaches name and alias to every declared profile, never for anonymous bylines', () => {
    const named = node({ sameAs: ['https://orcid.org/0000-0002-1825-0097'], alternateName: ['A. Nowak'] }, 'https://s.test/#anna', 'Anna Nowak');
    const scan = scanAuthors([], new Map(), new Map([['https://s.test/a', [node({ author: ['https://s.test/#anna'] }, undefined, undefined, ['Article'])]]]), new Map([['https://s.test/#anna', named]]), undefined);
    expect(scan.authors[0].profiles[0].subjects).toEqual(['Anna Nowak', 'A. Nowak']);
    const generic = scanAuthors([], new Map(), new Map([['https://s.test/a', [article]]]), new Map([['Anna Nowak', node({ sameAs: ['https://orcid.org/0000-0002-1825-0097'] }, undefined, 'Redakcja')]]), undefined);
    expect(generic.authors[0].profiles[0]?.subjects).toBeUndefined();
  });

  it('measures alignment from an author page found by name when jobTitle and knowsAbout are absent', () => {
    const authorPage = page('https://s.test/team/anna', { title: 'Anna Nowak - Team', focus_terms: [{ term: 'diabetes', weight: 5 }, { term: 'insulin', weight: 5 }] });
    expect(run([page('https://s.test/a'), authorPage]).alignmentPct).toBe(100);
  });

  it('shows no value (never invents one) when nothing describes the author', () => {
    expect(run([page('https://s.test/a', { title: 'Anna Nowak on diabetes', focus_terms: [{ term: 'diabetes', weight: 9 }] })]).alignmentPct).toBeUndefined();
    expect(run([page('https://s.test/team/jan', { title: 'Jan Kowalski', focus_terms: [{ term: 'diabetes', weight: 9 }] })]).alignmentPct).toBeUndefined();
  });
});
