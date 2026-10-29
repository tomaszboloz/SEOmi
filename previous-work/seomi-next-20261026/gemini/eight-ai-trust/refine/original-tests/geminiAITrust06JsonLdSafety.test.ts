import { describe, expect, it } from 'vitest';
import { buildTrustJsonLd, prefillFromAuthor, type TrustJsonLdInput } from '@/services/eeatTrust/jsonLd';
import type { AuthorEntity, TrustReport } from '@/services/eeatTrust/types';

describe('JSON-LD safety: explicit Person, IDs, Unicode, and breakout (#66)', () => {
  const baseInput: TrustJsonLdInput = {
    personName: 'Dr Jan Nowak',
    organizationUrl: 'https://example.test/',
    pageUrl: 'https://example.test/artykuly/zdrowie',
    sameAs: ['https://orcid.org/0000-0002-1825-0097'],
  };

  it('handles empty and partial explicit Person without inventing credentials or dates', () => {
    const emptyResult = buildTrustJsonLd({ ...baseInput, personName: '   ' });
    expect(emptyResult.ok).toBe(false);
    expect(emptyResult.issues).toContain('missing-name');

    const partial = buildTrustJsonLd({
      personName: 'Maria Wisniewska',
      organizationUrl: 'https://example.test/',
      pageUrl: 'https://example.test/poradnik',
      sameAs: [],
    });
    expect(partial.ok).toBe(true);
    const graph = partial.graph['@graph'] as Array<Record<string, unknown>>;
    const person = graph.find((node) => node['@type'] === 'Person')!;
    const webPage = graph.find((node) => node['@type'] === 'WebPage')!;

    expect(person.jobTitle).toBeUndefined();
    expect(person.sameAs).toBeUndefined();
    expect(person.url).toBeUndefined();
    expect(person['@id']).toBe('https://example.test/#maria-wisniewska');
    expect(webPage.dateModified).toBeUndefined();
    expect(webPage.lastReviewed).toBeUndefined();
    expect(webPage.reviewedBy).toBeUndefined();
    expect(webPage.author).toEqual({ '@id': 'https://example.test/#maria-wisniewska' });
  });

  it('prefillFromAuthor handles generic authors and invalid ID protocols safely', () => {
    const dummyReport = {
      schema: { organization: { name: 'Portal Zdrowia', sameAs: [] } },
      ymyl: 'health',
    } as unknown as TrustReport;

    const genericAuthor: AuthorEntity = {
      key: 'redakcja',
      name: 'Redakcja portalu',
      generic: true,
      sameAs: [],
      articleUrls: ['https://example.test/wstep'],
      profiles: [],
    };
    const prefilledGeneric = prefillFromAuthor(genericAuthor, dummyReport, 'https://example.test/');
    expect(prefilledGeneric.personName).toBe('');
    expect(prefilledGeneric.personUrl).toBeUndefined();

    const nonHttpAuthor: AuthorEntity = {
      key: 'jan',
      name: 'Jan',
      id: 'urn:uuid:6c84fb90-12c4-11e1-840d-7b25c5ee775a',
      generic: false,
      sameAs: [],
      articleUrls: [],
      profiles: [],
    };
    const prefilledNonHttp = prefillFromAuthor(nonHttpAuthor, dummyReport, 'https://example.test/');
    expect(prefilledNonHttp.personUrl).toBeUndefined();
    expect(prefilledNonHttp.pageUrl).toBe('https://example.test/');
  });

  it('normalizes conflicting observed person ID hashes and derives stable org links', () => {
    const result = buildTrustJsonLd({
      ...baseInput,
      personUrl: 'https://example.test/autor/jan#conflicting-fragment',
    });
    const graph = result.graph['@graph'] as Array<Record<string, unknown>>;
    const person = graph.find((node) => node['@type'] === 'Person')!;
    const webPage = graph.find((node) => node['@type'] === 'WebPage')!;

    expect(person['@id']).toBe('https://example.test/autor/jan#person');
    expect(person.worksFor).toEqual({ '@id': 'https://example.test/#organization' });
    expect(webPage.author).toEqual({ '@id': 'https://example.test/autor/jan#person' });
  });

  it('rejects invalid URL protocols across organization, page, and sameAs fields', () => {
    const invalid = buildTrustJsonLd({
      personName: 'Anna',
      organizationUrl: 'javascript:alert(1)',
      pageUrl: 'ftp://files.example.test/doc',
      personUrl: 'javascript:void(0)',
      sameAs: ['not-a-url', 'javascript:evil()', 'https://wikidata.org/wiki/Q42'],
    });
    expect(invalid.ok).toBe(false);
    expect(invalid.issues).toEqual(expect.arrayContaining(['invalid-organization-url', 'invalid-page-url', 'invalid-same-as']));
    const graph = invalid.graph['@graph'] as Array<Record<string, unknown>>;
    const person = graph.find((node) => node['@type'] === 'Person')!;
    expect(person.url).toBeUndefined();
    expect(person.sameAs).toEqual(['https://wikidata.org/wiki/Q42']);
  });

  it('safely processes Unicode characters and non-Latin names in slug generation', () => {
    const polishResult = buildTrustJsonLd({
      ...baseInput,
      personName: 'Prof. dr hab. Michał Żółć-Gęślą',
    });
    const polishGraph = polishResult.graph['@graph'] as Array<Record<string, unknown>>;
    const polishPerson = polishGraph.find((node) => node['@type'] === 'Person')!;
    expect(polishPerson.name).toBe('Prof. dr hab. Michał Żółć-Gęślą');
    expect(polishPerson['@id']).not.toContain(' ');
    expect(polishPerson['@id']).toMatch(/^https:\/\/example\.test\/#prof-dr-hab-micha/);

    const cjkResult = buildTrustJsonLd({
      ...baseInput,
      personName: '山田太郎',
    });
    const cjkGraph = cjkResult.graph['@graph'] as Array<Record<string, unknown>>;
    const cjkPerson = cjkGraph.find((node) => node['@type'] === 'Person')!;
    expect(cjkPerson.name).toBe('山田太郎');
    expect(cjkPerson['@id']).toBe('https://example.test/#person');
  });

  it('prevents script tag breakout inside serialized JSON-LD payload', () => {
    const breakoutInput: TrustJsonLdInput = {
      ...baseInput,
      personName: 'Dr Evil</script><script>alert("xss")</script>',
      jobTitle: '</script><script>exploit()</script>',
    };
    const result = buildTrustJsonLd(breakoutInput);
    const person = (result.graph['@graph'] as Array<Record<string, unknown>>)[1];
    expect(person.name).toBe('Dr Evil</script><script>alert("xss")</script>');
    expect(result.text).not.toContain('</script>');
  });
});
