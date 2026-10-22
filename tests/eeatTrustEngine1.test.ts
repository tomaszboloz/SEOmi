import { describe, expect, it } from 'vitest';
import { buildTrustReport, combineLayers, isGenericAuthor, isTrustedHost, levelFor } from '@/services/eeatTrust';
import { analyzeCitations, citationScore } from '@/services/eeatTrust/citations';
import { buildRegistry, nodesOf } from '@/services/eeatTrust/graph';
import { analyzeTransparency, transparencyScore } from '@/services/eeatTrust/transparency';
import { detectYmyl } from '@/services/eeatTrust/ymyl';
import { AUTHOR_ID, NOW, diabetesFocus, diabetesPages, extLink, trustedArticle, withRefs } from './eeatTrustFixtures';

const articles = (pages = diabetesPages()) => pages.filter((page) => page.url.includes('/articles/'));

describe('JSON-LD node reconstruction', () => {
  it('groups references by declaration and node path and merges registry entries by @id', () => {
    const page = trustedArticle(diabetesPages().find((item) => item.url.includes('/articles/'))!);
    const nodes = nodesOf(page);
    expect(nodes.map((item) => item.path).sort()).toEqual(['$', '$.@graph[1]', '$.@graph[2]']);
    const registry = buildRegistry([...nodes, ...nodes.map((item) => ({ ...item, props: { sameAs: ['https://x.test/a'] } }))]);
    expect(registry.get(AUTHOR_ID)?.props.sameAs).toEqual(['https://orcid.org/0000-0000-0000-0001', 'https://x.test/a']);
    expect(registry.get(AUTHOR_ID)?.name).toBe('Anna Nowak');
  });

  it('ignores non JSON-LD formats and falls back to the root path', () => {
    const page = { ...diabetesPages()[0], schema_references: [
      { format: 'Microdata', declaration_index: 0, property: 'name', value: 'x' },
      { format: 'JSON-LD', declaration_index: 0, property: '@type', value: 'Article' },
      { format: 'JSON-LD', declaration_index: 0, property: '@type', value: 'Article' },
    ] };
    const [only] = nodesOf(page);
    expect(only.path).toBe('$');
    expect(only.types).toEqual(['Article']);
  });
});

describe('citations', () => {
  it('recognises seed hosts and institutional suffixes', () => {
    ['who.int', 'pubmed.ncbi.nlm.nih.gov', 'cdc.gov', 'mz.gov.pl', 'uw.edu.pl', 'ox.ac.uk', 'x.doi.org', 'bmi.bund.de'].forEach((host) => expect(isTrustedHost(host), host).toBe(true));
    expect(isTrustedHost('blog.example')).toBe(false);
    expect(isTrustedHost('')).toBe(false);
  });

  it('scores trusted coverage and punishes dead checked links', () => {
    const [a, b] = articles();
    const pages = [
      withRefs(a, [], [extLink('https://www.who.int/x', 200), extLink('https://old.example/gone', 404), extLink('https://x.example/', undefined, 'timeout'), extLink('https://nolink.example')]),
      withRefs(b, [], [extLink('https://blog.example/', 200)]),
    ];
    const urls = new Set(pages.map((page) => page.url));
    const detail = analyzeCitations(pages, urls, new Map([[b.url, ['https://pubmed.ncbi.nlm.nih.gov/9/']]]));
    expect(detail).toMatchObject({ pagesAnalyzed: 2, pagesWithTrusted: 2, pagesWithAnyExternal: 2, checkedLinks: 4 });
    expect(detail.deadLinks).toHaveLength(2);
    expect(citationScore(detail)).toBe(75);
    expect(citationScore({ ...detail, pagesAnalyzed: 0 })).toBeUndefined();
    expect(citationScore({ ...detail, checkedLinks: 0, deadLinks: [] })).toBe(100);
  });

  it('skips pages outside the article set and pages without external links', () => {
    const [a, b] = articles();
    const detail = analyzeCitations([a, b], new Set([a.url]), new Map());
    expect(detail).toMatchObject({ pagesAnalyzed: 1, pagesWithTrusted: 0, pagesWithAnyExternal: 0 });
  });
});

describe('transparency', () => {
  const pages = (paths: string[]) => paths.map((path, index) => ({ ...diabetesPages()[0], url: `https://diabetes.test${path}`, final_url: `https://diabetes.test${path}`, title: index === 99 ? 'x' : null }));

  it('finds trust pages by URL segment and scores them with article dates', () => {
    const found = analyzeTransparency(pages(['/polityka-redakcyjna', '/o-nas', '/kontakt', '/impressum']), new Map());
    expect(Object.values(found.found).every(Boolean)).toBe(true);
    expect(transparencyScore(found)).toBe(100);
    const dated = analyzeTransparency(pages(['/kontakt']), new Map([['a', []], ['b', [{ page: 'b', decl: 0, path: '$', types: [], props: { dateModified: ['2026-01-01'] } }]]]));
    expect(dated).toMatchObject({ datedArticles: 1, articles: 2 });
    expect(transparencyScore(dated)).toBe(33);
  });

  it('matches titles, ignores errored pages and avoids substring false positives', () => {
    const list = [
      { ...diabetesPages()[0], url: 'https://diabetes.test/team', final_url: 'https://diabetes.test/team', title: 'Our editorial policy' },
      { ...diabetesPages()[0], url: 'https://diabetes.test/contact', final_url: 'https://diabetes.test/contact', http_status: 404 },
      { ...diabetesPages()[0], url: 'https://diabetes.test/snippets', final_url: 'https://diabetes.test/snippets', title: null },
      { ...diabetesPages()[0], url: 'https://diabetes.test/contact-lenses', final_url: 'https://diabetes.test/contact-lenses', request_error_kind: 'timeout' },
    ];
    const found = analyzeTransparency(list, new Map()).found;
    expect(found.editorial).toBe('https://diabetes.test/team');
    expect(found.contact).toBeUndefined();
    expect(found.registry).toBeUndefined();
  });
});

describe('YMYL detection', () => {
  it('uses schema types, the core topic and nothing for unrelated sites', () => {
    const focus = diabetesFocus();
    expect(detectYmyl([], focus, [])).toBe('health');
    expect(detectYmyl([{ page: 'p', decl: 0, path: '$', types: ['LoanOrCredit'], props: {} }], undefined, [])).toBe('finance');
    expect(detectYmyl([{ page: 'p', decl: 0, path: '$', types: ['LegalService'], props: {} }], undefined, [])).toBe('legal');
    expect(detectYmyl([], undefined, ['Best recipes', 'Cooking tips'])).toBeUndefined();
    expect(detectYmyl([], undefined, ['health', 'health'])).toBeUndefined();
  });
});

describe('helpers', () => {
  it('flags anonymous bylines and maps scores to levels', () => {
    ['Redakcja', 'Editorial team', 'admin', 'Zespół SEOmi', 'The Staff'].forEach((name) => expect(isGenericAuthor(name), name).toBe(true));
    expect(isGenericAuthor('Anna Nowak')).toBe(false);
    expect([90, 75, 60, 59, 40, 39].map(levelFor)).toEqual(['strong', 'strong', 'adequate', 'weak', 'weak', 'critical']);
  });

  it('renormalizes weights over the layers that have data', () => {
    expect(combineLayers({ schemaGraph: 100, transparency: 0 })).toBe(60);
    expect(combineLayers({ schemaGraph: 80, authorAlignment: 80, citationQuality: 80, transparency: 80 })).toBe(80);
    expect(combineLayers({})).toBe(0);
  });
});

describe('buildTrustReport', () => {
  it('assesses an empty crawl as critical with no article findings', () => {
    const report = buildTrustReport([], undefined, { now: NOW });
    expect(report).toMatchObject({ score: 0, level: 'critical', articleCount: 0, generatedAt: NOW });
    expect(report.findings.map((item) => item.code)).toContain('no-articles');
    expect(report.layers.authorAlignment).toBeUndefined();
    expect(buildTrustReport([]).generatedAt).toMatch(/^\d{4}-/);
  });
});
