import { describe, expect, it } from 'vitest';
import { generateSchemaGraph } from '@/services/schemaGenerator';
import { urlBreadcrumbItems, readablePathSegment } from '@/services/schemaGenerator/urls';
import type { TopicalMapDocument, TopicalEntityFact } from '@/services/topicalMap';
import i18n from '@/i18n';

describe('Schema generator safety: URLs, fragments, Unicode, and composition (#66)', () => {
  const baseEntity: TopicalMapDocument['entity'] = {
    name: 'Bezpieczna Firma',
    description: 'Opis firmy',
    facts: [],
  };

  it('rejects invalid page URLs and strips fragments to prevent conflicting node IDs', () => {
    expect(() => generateSchemaGraph({
      siteUrl: 'https://example.test',
      page: { url: 'javascript:alert(1)' },
      entity: baseEntity,
      includeOrganization: false,
    })).toThrow(i18n.t('runtimeErrors.schema.invalidUrl'));

    const result = generateSchemaGraph({
      siteUrl: 'https://example.test',
      page: { url: 'https://example.test/wpis#observed-hash', title: 'Tytuł' },
      entity: baseEntity,
      includeOrganization: false,
    });
    const graph = result.schema['@graph'] as Array<Record<string, unknown>>;
    const webPage = graph.find((node) => node['@type'] === 'WebPage')!;
    expect(webPage['@id']).toBe('https://example.test/wpis#webpage');
    expect(webPage.url).toBe('https://example.test/wpis');
  });

  it('drops facts with unsafe or non-http source URLs from organization additionalProperty', () => {
    const verifiedFacts: TopicalEntityFact[] = [
      { id: '1', attribute: 'KRS', value: '0000123456', sourceUrl: 'https://rejestr.test/krs', reuseStatus: 'verified' },
      { id: '2', attribute: 'NIP', value: '1234567890', sourceUrl: 'javascript:exploit()', reuseStatus: 'verified' },
      { id: '3', attribute: 'REGON', value: '987654321', sourceUrl: 'file:///etc/hosts', reuseStatus: 'verified' },
      { id: '4', attribute: 'Audyt', value: 'Pozytywny', sourceUrl: 'https://audyt.test/raport', reuseStatus: 'locked' },
    ];
    const result = generateSchemaGraph({
      siteUrl: 'https://example.test',
      page: { url: 'https://example.test/o-nas', title: 'O nas' },
      entity: { ...baseEntity, facts: verifiedFacts },
      includeOrganization: true,
    });
    const graph = result.schema['@graph'] as Array<Record<string, unknown>>;
    const org = graph.find((node) => node['@type'] === 'Organization')!;
    const properties = org.additionalProperty as Array<Record<string, unknown>>;
    expect(properties).toEqual([
      { '@type': 'PropertyValue', name: 'KRS', value: '0000123456', url: 'https://rejestr.test/krs' },
    ]);
    expect(result.usedVerifiedFacts).toBe(1);
  });

  it('preserves WebSite, WebPage, and BreadcrumbList without inventing authors or dates', () => {
    const result = generateSchemaGraph({
      siteUrl: 'https://example.test',
      page: { url: 'https://example.test/blog/post', title: 'Wpis na blogu' },
      entity: baseEntity,
      includeOrganization: false,
      includeUrlBreadcrumbs: true,
    });
    const graph = result.schema['@graph'] as Array<Record<string, unknown>>;
    expect(graph.map((node) => node['@type'])).toEqual(['WebSite', 'WebPage', 'BreadcrumbList']);
    const webPage = graph.find((node) => node['@type'] === 'WebPage')!;
    expect(webPage).not.toHaveProperty('author');
    expect(webPage).not.toHaveProperty('datePublished');
    expect(webPage).not.toHaveProperty('dateModified');
    expect(result.usedArticleType).toBeNull();
  });

  it('preserves canonical composed IDs and cross-references across graph nodes', () => {
    const result = generateSchemaGraph({
      siteUrl: 'https://example.test/portal',
      page: { url: 'https://example.test/portal/artykul#section', title: 'Artykuł', schemaTypes: ['Article'] },
      entity: { ...baseEntity, name: 'Portal' },
      includeOrganization: true,
      articleType: 'Article',
    });
    const graph = result.schema['@graph'] as Array<Record<string, any>>;
    const org = graph.find((n) => n['@type'] === 'Organization')!;
    const webSite = graph.find((n) => n['@type'] === 'WebSite')!;
    const webPage = graph.find((n) => n['@type'] === 'WebPage')!;
    const article = graph.find((n) => n['@type'] === 'Article')!;
    expect(webPage.isPartOf).toEqual({ '@id': webSite['@id'] });
    expect(webPage.publisher).toEqual({ '@id': org['@id'] });
    expect(article.mainEntityOfPage).toEqual({ '@id': webPage['@id'] });
    expect(article.publisher).toEqual({ '@id': org['@id'] });
  });

  it('correctly decodes percent-encoded Unicode path segments for breadcrumbs', () => {
    expect(readablePathSegment('%C5%BC%C3%B3%C5%82w-morski')).toBe('żółw morski');
    const breadcrumbs = urlBreadcrumbItems(new URL('https://example.test/kategorie/%C5%BC%C3%B3%C5%82wie'));
    expect(breadcrumbs).toHaveLength(2);
    expect(breadcrumbs[0]).toMatchObject({ position: 1, name: 'kategorie', item: 'https://example.test/kategorie' });
    expect(breadcrumbs[1]).toMatchObject({ position: 2, name: 'żółwie', item: 'https://example.test/kategorie/%C5%BC%C3%B3%C5%82wie' });
  });

  it('preserves Unicode entities and Polish diacritics in schema nodes', () => {
    const polishFacts: TopicalEntityFact[] = [
      { id: 'f1', attribute: 'główna siedziba', value: 'Kraków, Małopolska', sourceUrl: 'https://example.test/siedziba', reuseStatus: 'verified' },
    ];
    const result = generateSchemaGraph({
      siteUrl: 'https://example.test',
      page: { url: 'https://example.test/us%C5%82ugi', title: 'Usługi & Doradztwo' },
      entity: { name: 'Przedsiębiorstwo "Gżegżółka"', description: 'Opis z polskimi znakami: ąęćłńóśźż', facts: polishFacts },
      includeOrganization: true,
    });
    const graph = result.schema['@graph'] as Array<Record<string, unknown>>;
    const org = graph.find((node) => node['@type'] === 'Organization')!;
    expect(org.name).toBe('Przedsiębiorstwo "Gżegżółka"');
    expect(org.description).toBe('Opis z polskimi znakami: ąęćłńóśźż');
    expect(org.additionalProperty).toEqual([
      { '@type': 'PropertyValue', name: 'główna siedziba', value: 'Kraków, Małopolska', url: 'https://example.test/siedziba' },
    ]);
  });

  it('preserves exact declared text containing script tags without data loss in the schema graph', () => {
    const result = generateSchemaGraph({
      siteUrl: 'https://example.test',
      page: { url: 'https://example.test/test', title: 'Test</script><script>alert(1)</script>' },
      entity: { ...baseEntity, name: 'Org</script><script>alert(2)</script>' },
      includeOrganization: true,
    });
    const graph = result.schema['@graph'] as Array<Record<string, unknown>>;
    const webPage = graph.find((node) => node['@type'] === 'WebPage')!;
    const org = graph.find((node) => node['@type'] === 'Organization')!;
    expect(webPage.name).toBe('Test</script><script>alert(1)</script>');
    expect(org.name).toBe('Org</script><script>alert(2)</script>');
  });
});
