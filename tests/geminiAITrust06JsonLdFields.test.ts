import { describe, expect, it } from 'vitest';
import { buildTrustJsonLd, prefillFromAuthor, type TrustJsonLdInput } from '@/services/eeatTrust/jsonLd';
import { diffAgainstObserved } from '@/services/eeatTrust/jsonLdDiff';
import type { AuthorEntity, TrustReport } from '@/services/eeatTrust/types';

const base: TrustJsonLdInput = { personName: 'Anna Kowalska', organizationUrl: 'https://example.test/', pageUrl: 'https://example.test/a', sameAs: [] };
const nodes = (input: TrustJsonLdInput) => buildTrustJsonLd(input).graph['@graph'] as Array<Record<string, unknown>>;

describe('JSON-LD generator completion (#66)', () => {
  it('T03: MedicalWebPage only for health, never invents reviewer', () => {
    const health = nodes({ ...base, category: 'health' }).find((n) => String(n['@id']).endsWith('#webpage'))!;
    expect(health['@type']).toBe('MedicalWebPage');
    expect(health.reviewedBy).toBeUndefined();
    expect(health.lastReviewed).toBeUndefined();
    for (const category of ['finance', 'legal'] as const) expect(nodes({ ...base, category })[2]['@type']).toBe('WebPage');
    expect(nodes(base)[2]['@type']).toBe('WebPage');
  });

  it('T05: Person with ORCID in sameAs; prefill does not verify or invent optional fields', () => {
    const orcid = 'https://orcid.org/0000-0002-1825-0097';
    const person = nodes({ ...base, sameAs: [orcid] }).find((n) => n['@type'] === 'Person')!;
    expect(person.sameAs).toEqual([orcid]);
    const author: AuthorEntity = { key: 'a', name: 'Anna Kowalska', generic: false, sameAs: [orcid], articleUrls: [], profiles: [] };
    const report = { schema: { organization: { name: 'Portal', sameAs: [] } }, ymyl: 'health' } as unknown as TrustReport;
    const prefilled = prefillFromAuthor(author, report, 'https://example.test/');
    expect(prefilled.bio).toBeUndefined();
    expect(prefilled.credential).toBeUndefined();
    expect(prefilled.knowsAbout).toBeUndefined();
    expect(prefilled.sources).toMatchObject({ personName: 'crawl', sameAs: 'crawl', organizationName: 'report', organizationUrl: 'start-url', pageUrl: 'start-url' });
    expect(buildTrustJsonLd(prefilled).needsVerification).toEqual([]);
  });

  it('optional bio, credential and knowsAbout are emitted only when typed and flagged', () => {
    const empty = buildTrustJsonLd(base);
    const bare = (empty.graph['@graph'] as Array<Record<string, unknown>>)[1];
    expect(bare.description).toBeUndefined();
    expect(bare.hasCredential).toBeUndefined();
    expect(bare.knowsAbout).toBeUndefined();
    const full = buildTrustJsonLd({ ...base, bio: ' Kardiolog ', credential: 'lek. med.', knowsAbout: ['serce', ' ', 'EKG'] });
    const person = (full.graph['@graph'] as Array<Record<string, unknown>>)[1];
    expect(person.description).toBe('Kardiolog');
    expect(person.hasCredential).toEqual({ '@type': 'EducationalOccupationalCredential', name: 'lek. med.' });
    expect(person.knowsAbout).toEqual(['serce', 'EKG']);
    expect(full.needsVerification).toEqual(['bio', 'hasCredential', 'knowsAbout']);
  });

  it('keeps script-safe serialization with the new fields', () => {
    const result = buildTrustJsonLd({ ...base, bio: '</script><script>x()</script>', knowsAbout: ['</SCRIPT>'] });
    expect(result.text).not.toMatch(/<\/script/i);
    expect(result.text).not.toContain('<');
  });

  it('diffs added and removed properties against the observed graph by @id', () => {
    const observed = { '@graph': [{ '@id': 'x#p', '@type': 'Person', name: 'A', image: 'i.png' }, { '@type': 'Thing' }] };
    const proposed = { '@graph': [{ '@id': 'x#p', '@type': 'Person', name: 'B' }, { '@id': 'y', '@type': 'Organization' }] };
    const diff = diffAgainstObserved(observed, proposed);
    expect(diff.added.map((e) => `${e.id}:${e.property}`)).toEqual(['x#p:name', 'y:@type']);
    expect(diff.removed).toEqual([{ id: 'x#p', property: 'image', value: 'i.png' }]);
    expect(diffAgainstObserved(undefined, { '@graph': 'bad' })).toEqual({ added: [], removed: [] });
  });
});
