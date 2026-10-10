import { describe, expect, it } from 'vitest';
import { createCrawlPageFixture } from './fixtures/crawl';
import { buildDiagnosisDocuments } from '@/services/topicalDiagnosis/documents';
import { indexDocumentLinks } from '@/services/topicalDiagnosis/links';
import { assignRoles } from '@/services/topicalDiagnosis/roles';
import { buildAreas, NO_HUB_AREA_ID } from '@/services/topicalDiagnosis/areas';

const link = (target_url: string) => ({ target_url, anchor_text: 'x', is_internal: true });
const page = (url: string, patch: Record<string, unknown> = {}) => createCrawlPageFixture({
  url, final_url: url, semantic_language: 'pl', semantic_terms: ['temat', 'treść'], word_count: 900, ...patch,
});
const posts = ['a', 'b', 'c', 'd', 'e'].map((slug) => `https://ex.test/blog/${slug}/`);

const site = () => {
  const home = page('https://ex.test/', { semantic_links: [link('https://ex.test/blog/'), link(posts[0])], word_count: 500 });
  const blog = page('https://ex.test/blog/', { semantic_links: posts.map(link), word_count: 200 });
  const category = page('https://ex.test/blog/kat/', { semantic_links: posts.slice(0, 3).map(link), word_count: 120, title: 'Kategoria zdrowie | Ex' });
  const contact = page('https://ex.test/kontakt/');
  const articles = posts.map((url, index) => page(url, { semantic_links: index === 0 ? [link('https://ex.test/blog/kat/')] : [] }));
  return [home, blog, category, contact, ...articles];
};

const prepare = (pages: ReturnType<typeof page>[]) => {
  const { documents } = buildDiagnosisDocuments(pages, 'https://ex.test/');
  const links = indexDocumentLinks(documents);
  const roles = assignRoles(documents);
  const doc = (url: string) => roles.find((document) => document.primaryPage.url === url)!;
  return { roles, links, doc };
};

describe('document links', () => {
  it('resolves main-content links to documents and ignores self links and external links', () => {
    const { roles, links, doc } = prepare(site());
    expect(roles).toHaveLength(9);
    expect(links.linksTo(doc('https://ex.test/').id, doc('https://ex.test/blog/').id)).toBe(true);
    expect(links.linksTo(doc(posts[0]).id, doc('https://ex.test/blog/kat/').id)).toBe(true);
    expect(links.linksTo(doc(posts[1]).id, doc('https://ex.test/blog/').id)).toBe(false);
    expect([...links.incoming.get(doc(posts[0]).id)!]).toHaveLength(3);
  });
});

describe('roles', () => {
  it('marks listing pages as hubs, utility paths as utility, the rest as content', () => {
    const { doc } = prepare(site());
    expect(doc('https://ex.test/blog/').role).toBe('hub');
    expect(doc('https://ex.test/blog/kat/').role).toBe('content');
    expect(doc('https://ex.test/kontakt/').role).toBe('utility');
    expect(doc(posts[0]).role).toBe('content');
    expect(doc('https://ex.test/').role).toBe('content');
  });

  it('does not treat an article with a sibling list as a hub', () => {
    const items = ['a', 'b', 'c', 'd', 'e', 'f'].map((slug) => `https://ex.test/portfolio/${slug}/`);
    const index = page('https://ex.test/portfolio/', { semantic_links: items.map(link), word_count: 120 });
    const caseStudy = page(items[0], { semantic_links: items.slice(1).map(link), word_count: 300 });
    const { doc } = prepare([index, caseStudy, ...items.slice(1).map((url) => page(url))]);
    expect(doc('https://ex.test/portfolio/').role).toBe('hub');
    expect(doc(items[0]).role).toBe('content');
  });

  it('keeps a category that lists its own posts as a hub even when a bigger category links to it', () => {
    const big = ['a', 'b', 'c', 'd', 'e', 'f', 'g'].map((slug) => `https://ex.test/blog/${slug}/`);
    const small = ['h', 'i', 'j', 'k', 'l'].map((slug) => `https://ex.test/blog/${slug}/`);
    const bigCategory = page('https://ex.test/blog/kat-big/', { semantic_links: [...big, 'https://ex.test/blog/kat-small/'].map(link), word_count: 200 });
    const smallCategory = page('https://ex.test/blog/kat-small/', { semantic_links: small.map(link), word_count: 150 });
    const { doc } = prepare([bigCategory, smallCategory, ...[...big, ...small].map((url) => page(url))]);
    expect(doc('https://ex.test/blog/kat-big/').role).toBe('hub');
    expect(doc('https://ex.test/blog/kat-small/').role).toBe('hub');
  });

  it('keeps a pure listing as a hub even when the index covers all of its posts', () => {
    const posts = ['a', 'b', 'c', 'd', 'e', 'f'].map((slug) => `https://ex.test/blog/${slug}/`);
    const index = page('https://ex.test/blog/', { semantic_links: [...posts, 'https://ex.test/blog/kat/'].map(link), word_count: 90 });
    const category = page('https://ex.test/blog/kat/', { semantic_links: posts.slice(0, 5).map(link), word_count: 60 });
    const { doc } = prepare([index, category, ...posts.map((url) => page(url))]);
    expect(doc('https://ex.test/blog/kat/').role).toBe('hub');
  });

  it('treats paginated pages as hubs regardless of link count', () => {
    const { roles } = prepare([page('https://ex.test/blog/', { pagination_next: 'https://ex.test/blog/page/2/' })]);
    expect(roles[0].role).toBe('hub');
  });
});

describe('areas', () => {
  it('assigns each content document to the most specific linking hub and the rest to the no-hub area', () => {
    const pages = site();
    pages[2].semantic_links = [...posts.slice(0, 3), 'https://ex.test/blog/x/', 'https://ex.test/blog/y/', 'https://ex.test/oferta/cta/'].map(link);
    pages.push(page('https://ex.test/blog/x/'), page('https://ex.test/blog/y/'), page('https://ex.test/samotna/'), page('https://ex.test/oferta/cta/'));
    const { roles, links, doc } = prepare(pages);
    const { areas, areaByDocument } = buildAreas(roles, links);
    const category = doc('https://ex.test/blog/kat/');
    const blog = doc('https://ex.test/blog/');
    expect(category.role).toBe('hub');
    expect(areaByDocument.get(doc(posts[0]).id)).toBe(`area-${category.id}`);
    expect(areaByDocument.get(doc(posts[4]).id)).toBe(`area-${blog.id}`);
    expect(areaByDocument.get(doc('https://ex.test/samotna/').id)).toBe(NO_HUB_AREA_ID);
    expect(areaByDocument.get(doc('https://ex.test/oferta/cta/').id)).toBe(NO_HUB_AREA_ID);
    expect(areaByDocument.has(doc('https://ex.test/kontakt/').id)).toBe(false);
    const noHub = areas.find((area) => area.id === NO_HUB_AREA_ID)!;
    expect(noHub.hubId).toBeNull();
    expect(noHub.documentIds).toEqual([doc('https://ex.test/').id, doc('https://ex.test/samotna/').id, doc('https://ex.test/oferta/cta/').id]);
    expect(areas.find((area) => area.hubId === category.id)).toMatchObject({ label: 'Kategoria zdrowie', documentIds: [doc(posts[0]).id, doc(posts[1]).id, doc(posts[2]).id, doc('https://ex.test/blog/x/').id, doc('https://ex.test/blog/y/').id] });
  });

  it('keeps a hub without content members as an empty area and labels it by path when the title is empty', () => {
    const { roles, links } = prepare([page('https://ex.test/archiwum/', { pagination_next: 'https://ex.test/archiwum/page/2/', title: '' })]);
    const { areas } = buildAreas(roles, links);
    expect(areas).toEqual([{ id: `area-${roles[0].id}`, hubId: roles[0].id, label: '/archiwum/', documentIds: [] }]);
  });
});
