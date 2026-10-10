import { describe, expect, it } from 'vitest';
import { createCrawlPageFixture } from './fixtures/crawl';
import { buildTopicalDiagnosis } from '@/services/topicalDiagnosis';

const link = (target_url: string) => ({ target_url, anchor_text: 'x', is_internal: true });
const page = (url: string, patch: Record<string, unknown> = {}) => createCrawlPageFixture({
  url, final_url: url, semantic_language: 'pl', word_count: 800, hreflangs: [], ...patch,
});
const codes = (report: ReturnType<typeof buildTopicalDiagnosis>, code: string) => report.verdicts.filter((candidate) => candidate.code === code);
const posts = ['a', 'b', 'c', 'd', 'e', 'f'].map((slug) => `https://ex.test/blog/${slug}/`);

const site = () => {
  const hub = page('https://ex.test/blog/', { semantic_links: posts.map(link), word_count: 150, title: 'Blog' });
  const terms = [
    ['navigator', 'alerty', 'crm'], ['navigator', 'alerty', 'teams'], ['psychiatria', 'dzieci', 'szpital'],
    ['psychiatria', 'dzieci', 'oddział'], ['wordpress', 'kraków', 'bilety'], ['kurs', 'online', 'wstyd'],
  ];
  const titles = ['Alerty Sales Navigatora', 'Alerty Sales Navigatora w Teams', 'Psychiatria dzieci', 'Psychiatria dzieci na oddziale', 'WordCamp', 'Kursy online'];
  const articles = posts.map((url, index) => page(url, {
    semantic_terms: terms[index], title: titles[index],
    semantic_links: index === 0 ? [link('https://ex.test/blog/'), link(posts[1])] : index === 1 ? [link(posts[0])] : [],
  }));
  return [hub, ...articles];
};

describe('verdicts', () => {
  const report = buildTopicalDiagnosis(site(), 'https://ex.test/blog/');

  it('flags articles that do not link back to their hub, and not the one that does', () => {
    const missing = codes(report, 'hub-missing-backlink');
    const urls = missing.flatMap((candidate) => candidate.urls);
    expect(urls).not.toContain(posts[0]);
    expect(urls).toEqual(posts.slice(1));
    expect(missing[0]).toMatchObject({ severity: 'fix', scope: 'document', evidence: [{ key: 'hub', params: { hub: 'https://ex.test/blog/' } }], confidence: 'moderate' });
    expect(codes(report, 'area-healthy')).toHaveLength(0);
  });

  it('reports unlinked topic members only for the psychiatry topic', () => {
    const unlinked = codes(report, 'topic-members-unlinked');
    expect(unlinked).toHaveLength(1);
    expect(unlinked[0].urls).toEqual([posts[2], posts[3]]);
    expect(unlinked[0].evidence).toEqual([{ key: 'pairs', params: { count: 1 } }]);
  });

  it('marks two-document topics as thin and singletons as isolated with their nearest neighbour', () => {
    expect(codes(report, 'topic-thin')).toHaveLength(2);
    const isolated = codes(report, 'document-isolated');
    expect(isolated.flatMap((candidate) => candidate.urls)).toEqual([posts[4], posts[5]]);
    expect(isolated[0].evidence).toEqual([]);
    expect(codes(report, 'document-orphan')).toHaveLength(0);
    expect(codes(report, 'topic-no-hub')).toHaveLength(0);
  });

  it('emits no language verdicts for a single-language site', () => {
    expect(codes(report, 'language-pair-missing')).toHaveLength(0);
    expect(report.stats).toMatchObject({ pages: 7, documents: 7, hubs: 1, topics: 2, singletons: 2, languages: ['pl'], mergedPairs: 0 });
  });

  it('detects cannibalization and near duplicates', () => {
    const pages = site();
    pages[1].semantic_terms = ['navigator', 'alerty', 'crm', 'licencja'];
    pages[2].semantic_terms = ['navigator', 'alerty', 'crm', 'licencja'];
    pages[1].title = 'Alerty Sales Navigatora CRM';
    pages[2].title = 'Alerty Sales Navigatora CRM dwa';
    pages[3].content_hash = 'abc';
    pages[4].content_hash = 'abc';
    pages[5].content_simhash = '0000000000000000';
    pages[6].content_simhash = '0000000000000003';
    const result = buildTopicalDiagnosis(pages, 'https://ex.test/blog/');
    expect(codes(result, 'cannibalization-candidate')[0]).toMatchObject({
      severity: 'fix', urls: [posts[0], posts[1]],
      evidence: [{ key: 'similarity', params: { percent: 100 } }, { key: 'titleTokens', params: { value: 'alerty, sales, navigatora, crm' } }],
    });
    const duplicates = codes(result, 'near-duplicate');
    expect(duplicates[0]).toMatchObject({ severity: 'fix', urls: [posts[2], posts[3]], evidence: [{ key: 'hash', params: { value: 'abc' } }] });
    expect(duplicates[1]).toMatchObject({ severity: 'weak', urls: [posts[4], posts[5]], evidence: [{ key: 'distance', params: { value: 2 } }] });
  });

  it('reports topics spanning areas or without a hub and an orphan without any link', () => {
    const pages = site();
    pages[0].semantic_links = posts.slice(0, 5).map(link);
    pages[6].semantic_terms = ['wordpress', 'kraków', 'bilety'];
    const result = buildTopicalDiagnosis(pages, 'https://ex.test/blog/');
    const noHub = codes(result, 'topic-no-hub');
    expect(noHub).toHaveLength(1);
    expect(noHub[0].evidence).toEqual([{ key: 'areas', params: { count: 1 } }, { key: 'withoutHub', params: { count: 1 } }]);
    expect(codes(result, 'document-orphan').flatMap((candidate) => candidate.urls)).toEqual([posts[5]]);
    expect(codes(result, 'document-isolated')).toHaveLength(0);
  });

  it('does not report a topic without a hub when one member links to all the others', () => {
    const pages = site();
    pages[0].semantic_links = posts.slice(0, 5).map(link);
    pages[6].semantic_terms = ['wordpress', 'kraków', 'bilety'];
    pages[5].semantic_links = [link(posts[5])];
    const result = buildTopicalDiagnosis(pages, 'https://ex.test/blog/');
    expect(codes(result, 'topic-no-hub')).toHaveLength(0);
  });

  it('marks verdicts of documents with partial evidence as limited', () => {
    const pages = site();
    pages[2].body_truncated = true;
    const result = buildTopicalDiagnosis(pages, 'https://ex.test/blog/');
    expect(codes(result, 'hub-missing-backlink').find((candidate) => candidate.urls[0] === posts[1])?.confidence).toBe('limited');
  });

  it('orders verdicts fix, weak, info, good', () => {
    const order = ['fix', 'weak', 'info', 'good'];
    const seen = report.verdicts.map((candidate) => order.indexOf(candidate.severity));
    expect([...seen].sort((a, b) => a - b)).toEqual(seen);
  });
});
