import { describe, expect, it } from 'vitest';
import type { CrawledPageSummary } from '@/types';
import { isGenericAuthor, resolveEntities, scanAuthors } from '@/services/eeatTrust/authors';
import { buildRegistry, type SchemaNode } from '@/services/eeatTrust/graph';

const makeNode = (page: string, path: string, types: string[], props: Record<string, string[]> = {}, id?: string, name?: string, decl = 0): SchemaNode =>
  ({ page, decl, path, types, props, id, name });
const makePage = (url: string, title = 'Article'): CrawledPageSummary =>
  ({ url, final_url: url, http_status: 200, title, schema_references: [] }) as unknown as CrawledPageSummary;

describe('EETV authors and entity reconciliation regressions (#65, #87, #109)', () => {
  describe('role definition vs @id reference resolution', () => {
    it('resolves author defined via @id reference in registry with full profile data', () => {
      const authorId = 'https://site.test/authors/anna#person';
      const article = makeNode('https://site.test/article-1', '$', ['Article'], { author: [authorId] });
      const authorDef = makeNode('https://site.test/authors/anna', '$.@graph[0]', ['Person'], {
        jobTitle: ['Endocrinologist'], sameAs: ['https://orcid.org/0000-0000-0000-0001'],
      }, authorId, 'Dr Anna Nowak');
      const resolved = resolveEntities(article, 'author', [], buildRegistry([authorDef]));
      expect(resolved).toHaveLength(1);
      expect(resolved[0]).toMatchObject({ id: authorId, name: 'Dr Anna Nowak', props: { jobTitle: ['Endocrinologist'] } });
    });

    it('falls back to entity id when referenced @id is missing from registry', () => {
      const missingId = 'https://site.test/authors/unknown#person';
      const article = makeNode('https://site.test/article-1', '$', ['Article'], { author: [missingId] });
      const resolved = resolveEntities(article, 'author', [], buildRegistry([]));
      expect(resolved).toHaveLength(1);
      expect(resolved[0].id).toBe(missingId);
      expect(resolved[0].name).toBeUndefined();
    });

    it('resolves plain string author bylines without id or registry entry', () => {
      const article = makeNode('https://site.test/article-1', '$', ['Article'], { author: ['Jan Kowalski'] });
      const resolved = resolveEntities(article, 'author', [], new Map());
      expect(resolved).toHaveLength(1);
      expect(resolved[0]).toMatchObject({ id: undefined, name: 'Jan Kowalski', types: ['Person'] });
    });

    it('resolves inline child nodes declared in same declaration tree', () => {
      const article = makeNode('https://site.test/article-1', '$', ['Article']);
      const inlineChild = makeNode('https://site.test/article-1', '$.author', ['Person'], {}, undefined, 'Dr Jan Nowak');
      const resolved = resolveEntities(article, 'author', [article, inlineChild], new Map());
      expect(resolved).toHaveLength(1);
      expect(resolved[0].name).toBe('Dr Jan Nowak');
    });
  });

  describe('Unicode aliases and generic byline classification', () => {
    it('identifies generic editorial teams with multilingual and Unicode names', () => {
      for (const name of ['Zespół Redakcyjny', 'zespół redakcji', 'Rédaction Santé', 'Redacción Médica', 'Команда Портала', 'Редакция', 'Администрация сайта', 'The Editorial Board']) {
        expect(isGenericAuthor(name)).toBe(true);
      }
    });

    it('does not classify genuine author names containing Unicode diacritics as generic', () => {
      for (const name of ['Michał Żółciński', 'Łukasz Bąk', 'Élodie Dubois', 'François Mitterrand', 'Stanisław Lem']) {
        expect(isGenericAuthor(name)).toBe(false);
      }
    });
  });

  describe('scanAuthors aggregation, unknown credentials, and missing data', () => {
    it('aggregates articles per author across multiple pages and separates reviewers', () => {
      const authorId = 'https://site.test/authors/anna#person';
      const reviewerId = 'https://site.test/authors/piotr#person';
      const page1 = makePage('https://site.test/article-1');
      const page2 = makePage('https://site.test/article-2');
      const art1 = makeNode(page1.url, '$', ['Article'], { author: [authorId], reviewedBy: [reviewerId] });
      const art2 = makeNode(page2.url, '$', ['Article'], { author: [authorId] });
      const annaNode = makeNode(page1.url, '$.a', ['Person'], { sameAs: ['https://orcid.org/0000-0000-0000-0001'] }, authorId, 'Anna Nowak');
      const piotrNode = makeNode(page1.url, '$.p', ['Person'], {}, reviewerId, 'Piotr Wiśniewski');

      const registry = buildRegistry([annaNode, piotrNode]);
      const nodesByPage = new Map([[page1.url, [art1, annaNode, piotrNode]], [page2.url, [art2]]]);
      const articleNodes = new Map([[page1.url, [art1]], [page2.url, [art2]]]);
      const scan = scanAuthors([page1, page2], nodesByPage, articleNodes, registry, undefined);

      expect(scan.authors).toHaveLength(1);
      expect(scan.authors[0]).toMatchObject({ key: authorId.toLowerCase(), name: 'Anna Nowak', articleUrls: [page1.url, page2.url], generic: false });
      expect(scan.withAuthor.size).toBe(2);
      expect(scan.withReviewer.has(page1.url)).toBe(true);
      expect(scan.withReviewer.has(page2.url)).toBe(false);
    });

    it('leaves alignmentPct undefined (missing data, not zero) when bio terms are unavailable', () => {
      const authorId = 'https://site.test/authors/anna#person';
      const page = makePage('https://site.test/article-1');
      const art = makeNode(page.url, '$', ['Article'], { author: [authorId] });
      const authorNode = makeNode(page.url, '$.a', ['Person'], {}, authorId, 'Anna Nowak');
      const scan = scanAuthors([page], new Map([[page.url, [art, authorNode]]]), new Map([[page.url, [art]]]), buildRegistry([authorNode]), undefined);
      expect(scan.authors[0].alignmentPct).toBeUndefined();
    });

    it('classifies unknown credentials in author sameAs without treating them as verified', () => {
      const authorId = 'https://site.test/authors/anna#person';
      const page = makePage('https://site.test/article-1');
      const art = makeNode(page.url, '$', ['Article'], { author: [authorId] });
      const authorNode = makeNode(page.url, '$.a', ['Person'], {
        sameAs: ['mailto:anna@site.test', 'https://hospital.test/credentials/id123', 'MD Board Certified'],
      }, authorId, 'Anna Nowak');
      const scan = scanAuthors([page], new Map([[page.url, [art, authorNode]]]), new Map([[page.url, [art]]]), buildRegistry([authorNode]), undefined);
      const profiles = scan.authors[0].profiles;
      expect(profiles.some((p) => (p.status as string) === 'verified')).toBe(false);
      expect(profiles.filter((p) => p.status === 'syntax-valid')).toHaveLength(0);
    });

    it('does not treat declared sameAs on forged host as verified persona or syntax-valid profile', () => {
      const authorId = 'https://site.test/authors/anna#person';
      const page = makePage('https://site.test/article-1');
      const art = makeNode(page.url, '$', ['Article'], { author: [authorId] });
      const forgedUrl = 'https://orcid.org.evil-spoof.test/0000-0000-0000-0001';
      const authorNode = makeNode(page.url, '$.a', ['Person'], { sameAs: [forgedUrl] }, authorId, 'Anna Nowak');
      const scan = scanAuthors([page], new Map([[page.url, [art, authorNode]]]), new Map([[page.url, [art]]]), buildRegistry([authorNode]), undefined);
      const author = scan.authors[0];
      expect(author.profiles).toHaveLength(1);
      expect(author.profiles[0]).toMatchObject({ kind: 'other', status: 'declared' });
      expect(author.profiles[0].tier).toBeUndefined();
      expect((author.profiles[0].status as string)).not.toBe('syntax-valid');
      expect((author.profiles[0].status as string)).not.toBe('verified');
    });

    it('deduplicates case-variant sameAs aliases on author node without inflating profiles', () => {
      const authorId = 'https://site.test/authors/anna#person';
      const page = makePage('https://site.test/article-1');
      const art = makeNode(page.url, '$', ['Article'], { author: [authorId] });
      const authorNode = makeNode(page.url, '$.a', ['Person'], {
        sameAs: ['https://orcid.org/0000-0000-0000-0001', 'https://ORCID.ORG/0000-0000-0000-0001/'],
      }, authorId, 'Anna Nowak');
      const scan = scanAuthors([page], new Map([[page.url, [art, authorNode]]]), new Map([[page.url, [art]]]), buildRegistry([authorNode]), undefined);
      const author = scan.authors[0];
      expect(author.sameAs).toHaveLength(2);
      expect(author.profiles).toHaveLength(1);
      expect(author.profiles[0].status).toBe('syntax-valid');
      expect((author.profiles[0].status as string)).not.toBe('verified');
      expect((author as unknown as { verified?: boolean }).verified).toBeUndefined();
    });
  });
});
