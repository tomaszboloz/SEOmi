import { describe, expect, it } from 'vitest';
import { buildTrustReport } from '@/services/eeatTrust';
import { canonicalProfileUrl, classifyProfile, classifyProfiles, declarationRecall, reconciliationStatus } from '@/services/eeatTrust/identifiers';
import { roleWeightedRecall, scanRoleEntities } from '@/services/eeatTrust/roles';
import { buildRegistry, nodesOf } from '@/services/eeatTrust/graph';
import type { AuthorEntity, ProfileEvidence, RoleEntity } from '@/services/eeatTrust';
import { NOW, diabetesPages, node, withRefs } from './eeatTrustFixtures';

const REVIEWER = 'https://diabetes.test/reviewers/jan#person';
const ORG = 'https://diabetes.test/#organization';

describe('sameAs canonical dedupe (#87)', () => {
  it('normalizes scheme, www/m host, fragment, tracking params, query order and trailing slashes', () => {
    expect(canonicalProfileUrl('http://WWW.LinkedIn.com/in/Jan-K/?utm_source=x&trk=y#about')).toBe('https://linkedin.com/in/jan-k');
    expect(canonicalProfileUrl('https://m.facebook.com/jan/')).toBe('https://facebook.com/jan');
    expect(canonicalProfileUrl('https://scholar.google.com/citations?user=AB&hl=pl')).toBe('https://scholar.google.com/citations?user=ab');
    expect(canonicalProfileUrl('https://a.test/p?b=2&a=1')).toBe('https://a.test/p?a=1&b=2');
    expect(canonicalProfileUrl('https://a.test:8443/p')).toBe('https://a.test:8443/p');
    expect(canonicalProfileUrl(' Not A Url ')).toBe('not a url');
  });

  it('counts one profile written several ways once, keeping distinct profiles', () => {
    const profiles = classifyProfiles([
      'https://www.linkedin.com/in/jan', 'http://linkedin.com/in/jan/?utm_campaign=a', 'https://linkedin.com/in/jan#x',
      'https://linkedin.com/in/anna', 'https://scholar.google.com/citations?user=a&hl=en', 'https://scholar.google.com/citations?user=b',
    ]);
    expect(profiles.map((profile) => profile.url)).toEqual([
      'https://www.linkedin.com/in/jan', 'https://linkedin.com/in/anna',
      'https://scholar.google.com/citations?user=a&hl=en', 'https://scholar.google.com/citations?user=b',
    ]);
    expect(declarationRecall(profiles)).toBeCloseTo(0.66);
  });

  it('accepts a lowercase ORCID check character and dedupes it with the canonical form', () => {
    expect(classifyProfile('https://orcid.org/0000-0002-9079-593x')).toMatchObject({ id: '0000-0002-9079-593X', status: 'syntax-valid' });
    expect(classifyProfiles(['https://orcid.org/0000-0002-9079-593x', 'https://orcid.org/0000-0002-9079-593X'])).toHaveLength(1);
  });

  it('ranks conflicts before positive results and reports missing evidence as unavailable', () => {
    const of = (status: ProfileEvidence['status']): ProfileEvidence => ({ url: 'u', kind: 'other', status });
    expect(reconciliationStatus([of('verified'), of('mismatch')])).toBe('mismatch');
    expect(reconciliationStatus([of('declared')])).toBe('declared');
    expect(reconciliationStatus([])).toBe('unavailable');
  });
});

const article = (page: ReturnType<typeof diabetesPages>[number], withSameAs: boolean) => withRefs(page, [
  ...node('$', { type: 'MedicalWebPage', props: [['reviewedBy', REVIEWER], ['publisher', ORG], ['reviewedBy', 'Ewa Inline']] }),
  ...node('$.@graph[1]', { id: REVIEWER, type: 'Person', name: 'Jan Kowalski', props: withSameAs
    ? [['sameAs', 'https://orcid.org/0000-0002-1825-0097'], ['sameAs', 'http://www.orcid.org/0000-0002-1825-0097/']] : [] }, 1),
  ...node('$.@graph[2]', { id: ORG, type: 'Organization', name: 'Diabetes Test', props: [['sameAs', 'https://www.wikidata.org/wiki/Q42']] }, 1),
]);

describe('reviewer and publisher reconciliation (#87)', () => {
  const pages = diabetesPages().filter((page) => page.url.includes('/articles/')).slice(0, 2);
  const marked = [article(pages[0], true), article(pages[1], false)];

  it('merges role entities by @id across pages and unions their sameAs', () => {
    const nodesByPage = new Map(marked.map((page) => [page.final_url || page.url, nodesOf(page)]));
    const registry = buildRegistry([...nodesByPage.values()].flat());
    const roles = scanRoleEntities(nodesByPage, new Map([...nodesByPage].map(([url, nodes]) => [url, nodes.filter((item) => item.path === '$')])), registry);
    const reviewer = roles.find((entity) => entity.id === REVIEWER)!;
    expect(reviewer).toMatchObject({ role: 'reviewer', name: 'Jan Kowalski', articleUrls: [marked[0].url, marked[1].url] });
    expect(reviewer.reconciliation).toMatchObject({ role: 'reviewer', status: 'syntax-valid', evidence: 'declared', declarationRecall: 0.45 });
    expect(reviewer.reconciliation.profiles).toHaveLength(1);
    expect(roles.find((entity) => entity.name === 'Ewa Inline')?.reconciliation.status).toBe('unavailable');
    expect(roles.find((entity) => entity.role === 'publisher')?.reconciliation.profiles[0]).toMatchObject({ kind: 'wikidata', id: 'Q42' });
    expect(roles.some((entity) => entity.reconciliation.status === 'verified')).toBe(false);
  });

  it('skips anonymous nodes, names unresolved ids by their @id and counts repeated references once', () => {
    const page = withRefs(pages[0], [
      ...node('$', { type: 'Article', props: [['reviewedBy', 'https://x.test/#r'], ['reviewedBy', 'https://x.test/#r']] }),
      ...node('$.publisher', { type: 'Organization', props: [['sameAs', 'https://x.com/a'], ['sameAs', 'https://x.com/a']] }),
    ]);
    const nodes = nodesOf(page);
    const roles = scanRoleEntities(new Map([[page.url, nodes]]), new Map([[page.url, nodes.filter((item) => item.path === '$')], ['https://gone.test/', []]]), new Map());
    expect(roles).toEqual([expect.objectContaining({ role: 'reviewer', name: 'https://x.test/#r', articleUrls: [page.url] })]);
  });

  it('weights roles .50/.25/.25 and drops a role that names nobody instead of scoring it zero', () => {
    const author = { generic: false, reconciliation: { declarationRecall: 1 } } as AuthorEntity;
    const role = (kind: RoleEntity['role'], recall: number) => ({ role: kind, reconciliation: { declarationRecall: recall } }) as RoleEntity;
    expect(roleWeightedRecall([author], [role('reviewer', 0), role('publisher', 0.45)])).toBeCloseTo(0.6125);
    expect(roleWeightedRecall([], [role('publisher', 0.45)])).toBeCloseTo(0.45);
    expect(roleWeightedRecall([{ ...author, generic: true }], [])).toBeUndefined();
    expect(roleWeightedRecall([{ ...author, reconciliation: undefined }], [])).toBe(0);
  });

  it('exposes role entities and role recall on the trust report', () => {
    const report = buildTrustReport(marked, undefined, { now: NOW });
    expect(report.roleEntities?.map((entity) => entity.role)).toEqual(['publisher', 'reviewer', 'reviewer']);
    expect(report.roleRecall).toBeCloseTo((0.25 * 0.225 + 0.25 * 0.45) / 0.5);
    expect(buildTrustReport([], undefined, { now: NOW }).roleRecall).toBeUndefined();
  });
});
