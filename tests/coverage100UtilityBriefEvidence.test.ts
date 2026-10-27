import { describe, expect, it } from 'vitest';
import { matchParagraphToCrawlSource } from '@/services/briefDocument/evidence';
import { buildContentBriefExport, buildContentBriefMarkdown } from '@/services/briefDocument/handoff';
import { saveDraftVersion } from '@/services/briefDocument/versions';

const brief = (overrides: Record<string, unknown> = {}) => ({
  targetQueryId: 'q', snippetTarget: 'definition', requiredEntities: [], internalLinkTargets: [], draftMarkdown: 'Draft text', paragraphReviews: [], draftVersions: [], ...overrides,
} as never);
const node = (overrides: Record<string, unknown> = {}) => ({ id: 'node', title: 'Topic', lifecycle: 'draft', queries: [{ id: 'q', text: 'target query' }], ...overrides } as never);
const page = (overrides: Record<string, unknown> = {}) => ({
  url: 'https://site.test/page', final_url: 'https://site.test/page', http_status: 200, title: 'SEO audit', semantic_terms: ['seo audit', 'crawl evidence', 'technical report'], semantic_excerpts: ['SEO audit evidence explains crawl evidence for technical report readers.'], redirect_chain: [], ...overrides,
} as never);

describe('content brief evidence and handoff edges', () => {
  it('distinguishes missing snapshots, exact excerpts, sentence matches and semantic terms', () => {
    expect(matchParagraphToCrawlSource('text', 'https://missing.test', [page()])).toMatchObject({ matched: false, scope: 'not-in-snapshot' });
    expect(matchParagraphToCrawlSource('SEO audit evidence explains crawl evidence for technical report readers.', 'https://site.test/page', [page()])).toMatchObject({ matched: true, scope: 'excerpt', overlapPercent: 100 });
    expect(matchParagraphToCrawlSource('SEO audit evidence for technical report readers.', 'https://site.test/page', [page()])).toMatchObject({ matched: true, scope: 'sentence-match' });
    expect(matchParagraphToCrawlSource('SEO audit crawl evidence technical report', 'https://site.test/page', [page({ semantic_excerpts: [] })])).toMatchObject({ matched: true, scope: 'semantic-terms' });
    expect(matchParagraphToCrawlSource('SEO audit', 'https://site.test/page', [page({ http_status: 500 })])).toMatchObject({ matched: false, scope: 'no-signal' });
  });

  it('serializes explicit user data and handles empty markdown handoff fields', () => {
    const exported = buildContentBriefExport(node(), brief(), '2026-10-23T00:00:00Z');
    expect(exported).toMatchObject({ schemaVersion: 1, exportedAt: '2026-10-23T00:00:00Z', node: { id: 'node', title: 'Topic' } });
    const markdown = buildContentBriefMarkdown(node({ title: ' ', queries: [] }), brief({ draftMarkdown: '', requiredEntities: [], internalLinkTargets: [] }));
    expect(markdown).toContain('not selected');
    expect(markdown).toContain('No draft');
    expect(markdown).toContain('No declared entities');
  });

  it('deduplicates explicit draft checkpoints and bounds version history', () => {
    expect(saveDraftVersion(brief({ draftMarkdown: ' ' }))).toEqual(brief({ draftMarkdown: ' ' }));
    const first = saveDraftVersion(brief(), ' note ', '2026-10-23T00:00:00Z');
    expect(saveDraftVersion(first, 'note', '2026-10-24T00:00:00Z')).toBe(first);
    let current = first;
    for (let index = 0; index < 35; index += 1) current = saveDraftVersion({ ...current, draftMarkdown: `Draft ${index}` }, String(index), `2026-10-${String(index + 1).padStart(2, '0')}`);
    expect(current.draftVersions).toHaveLength(30);
  });
});
