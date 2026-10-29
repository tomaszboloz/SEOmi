import { describe, expect, it } from 'vitest';
import { buildTrustReport } from '@/services/eeatTrust';
import { resolveEntities } from '@/services/eeatTrust/authors';
import { buildFindings } from '@/services/eeatTrust/findings';
import { nodesOf } from '@/services/eeatTrust/graph';
import { summarizeTrust, TRUST_PDF_AUTHORS } from '@/services/eeatTrust/summary';
import { AUTHOR_ID, NOW, diabetesFocus, diabetesPages, node, trustedArticle, withRefs } from './eeatTrustFixtures';

const isArticle = (url: string) => url.includes('/articles/');

const site = (mutate: (page: ReturnType<typeof diabetesPages>[number], index: number) => ReturnType<typeof diabetesPages>[number]) => {
  const pages = diabetesPages().map((page, index) => (isArticle(page.url) ? mutate(page, index) : page));
  return { pages, focus: diabetesFocus(pages) };
};

describe('fully attributed site', () => {
  const { pages, focus } = site((page) => trustedArticle(page));
  const home = withRefs(pages[0], [], []);
  const withPages = [home, ...pages.slice(1), ...['/polityka-redakcyjna', '/kontakt', '/impressum', '/o-nas'].map((path) => ({ ...pages[0], url: `https://diabetes.test${path}`, final_url: `https://diabetes.test${path}` }))];
  const report = buildTrustReport(withPages, focus, { now: NOW });

  it('scores every layer and reports the author entity with sameAs and topic alignment', () => {
    expect(report.articleCount).toBeGreaterThan(10);
    expect(report.ymyl).toBe('health');
    expect(report.authors).toHaveLength(1);
    expect(report.authors[0]).toMatchObject({ name: 'Anna Nowak', id: AUTHOR_ID, generic: false });
    expect(report.authors[0].alignmentPct).toBeGreaterThanOrEqual(50);
    expect(report.layers.schemaGraph).toBeGreaterThanOrEqual(90);
    expect(report.layers.citationQuality).toBeGreaterThanOrEqual(80);
    expect(report.layers.transparency).toBeGreaterThanOrEqual(90);
    expect(report.level).toBe('strong');
    expect(report.ymylUnattributedPct).toBeLessThan(20);
    expect(report.findings.map((item) => item.code)).not.toContain('ymyl-no-reviewer');
  });

  it('summarizes for the PDF without heavy fields and caps the author list', () => {
    const summary = summarizeTrust(report);
    expect(summary).toMatchObject({ score: report.score, ymyl: 'health', organization: { present: true, has_id: true, same_as: 1 } });
    expect(summary.layers.schema_graph).toBe(report.layers.schemaGraph);
    expect(summary.pages.editorial).toContain('polityka-redakcyjna');
    expect(summary.authors.length).toBeLessThanOrEqual(TRUST_PDF_AUTHORS);
    const many = { ...report, authors: Array.from({ length: 30 }, (_, i) => ({ ...report.authors[0], key: `k${i}`, alignmentPct: undefined })) };
    expect(summarizeTrust(many).authors).toHaveLength(TRUST_PDF_AUTHORS);
    expect(summarizeTrust({ ...report, layers: {}, ymyl: undefined, ymylUnattributedPct: undefined }).layers.schema_graph).toBeNull();
  });
});

describe('anonymous YMYL site', () => {
  const { pages, focus } = site((page) => withRefs(page, [
    ...node('$', { type: 'Article', props: [['author', 'Redakcja'], ['publisher', 'https://diabetes.test/#org']] }),
  ], []));
  const report = buildTrustReport(pages, focus, { now: NOW });

  it('raises critical YMYL findings and a low score', () => {
    const codes = report.findings.map((item) => `${item.severity}:${item.code}`);
    expect(codes).toEqual(expect.arrayContaining(['critical:ymyl-unattributed', 'critical:ymyl-no-reviewer', 'warning:generic-author', 'warning:org-missing', 'warning:missing-editorial', 'warning:missing-contact', 'warning:missing-dates']));
    expect(report.ymylUnattributedPct).toBe(100);
    expect(report.level).toBe('critical');
    expect(report.findings[0].severity).toBe('critical');
    expect(report.layers.authorAlignment).toBe(0);
  });
});

describe('unavailable trust summaries', () => {
  it('keeps the PDF score, level and layers unknown when no page was usable', () => {
    const report = buildTrustReport([{ ...diabetesPages()[0], http_status: 500 }], undefined, { now: NOW });
    expect(report.availability).toBe('unavailable');
    expect(summarizeTrust(report)).toMatchObject({ score: null, level: null, layers: { schema_graph: null, author_alignment: null, citation_quality: null, transparency: null } });
  });
});

describe('weak author entities', () => {
  const { pages, focus } = site((page, index) => withRefs(page, [
    ...node('$', { type: 'BlogPosting', props: [['author', index % 2 ? 'https://diabetes.test/#ghost' : 'Jan Kowalski']] }),
  ]));
  const report = buildTrustReport(pages, focus, { now: NOW });

  it('reports authors without sameAs, ids or topical bio, and unresolved ids', () => {
    const codes = report.findings.map((item) => item.code);
    expect(codes).toContain('author-no-same-as');
    expect(codes).toContain('author-no-id');
    expect(report.authors.map((author) => author.name)).toContain('https://diabetes.test/#ghost');
    expect(report.authors.every((author) => author.alignmentPct === undefined)).toBe(true);
  });

  it('skips authors that have neither id nor name', () => {
    const nodes = nodesOf(withRefs(pages[0], node('$', { type: 'Article', props: [['author', '']] })));
    expect(resolveEntities(nodes[0], 'author', nodes, new Map())).toEqual([]);
  });
});

describe('inline author objects and off-topic bios', () => {
  const { pages, focus } = site((page) => withRefs(page, [
    ...node('$', { type: 'Article' }),
    ...node('$.author', { type: 'Person', name: 'Marek Marketing', props: [['jobTitle', 'Copywriter marketing'], ['url', 'https://diabetes.test/team/marek']] }),
  ]));
  const report = buildTrustReport(pages, focus, { now: NOW });

  it('resolves nested authors and flags a bio outside the Core Topic', () => {
    expect(report.authors[0].name).toBe('Marek Marketing');
    expect(report.authors[0].alignmentPct).toBeLessThan(40);
    expect(report.findings.some((item) => item.code === 'author-off-topic')).toBe(true);
  });

  it('uses the profile page terms when the author url is a crawled page', () => {
    const profile = { ...pages[1], url: 'https://diabetes.test/team/marek', final_url: 'https://diabetes.test/team/marek' };
    const next = buildTrustReport([...pages, profile], focus, { now: NOW });
    expect(next.authors[0].alignmentPct).toBeGreaterThan(report.authors[0].alignmentPct ?? 0);
  });
});

describe('findings', () => {
  const base = buildTrustReport(site((page) => trustedArticle(page)).pages, diabetesFocus(), { now: NOW });
  const input = { schema: base.schema, authors: base.authors, citations: base.citations, transparency: base.transparency, ymyl: undefined, unattributed: 0 };

  it('adds citation, entity and date findings from thresholds', () => {
    const codes = buildFindings({
      ...input,
      schema: { ...input.schema, organization: { present: true, hasId: true, sameAs: [] }, articlesWithAuthor: 0 },
      citations: { ...input.citations, pagesWithTrusted: 0, deadLinks: [{ page: 'p', target: 't' }] },
      transparency: { ...input.transparency, datedArticles: 0, found: { editorial: undefined, about: undefined, contact: undefined, registry: undefined } },
    }).map((item) => item.code);
    expect(codes).toEqual(expect.arrayContaining(['org-no-same-as', 'no-bylines', 'low-citations', 'dead-citations', 'missing-registry', 'missing-about', 'missing-dates']));
  });
});
