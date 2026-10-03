import { describe, expect, it } from 'vitest';
import { auditPageIndex, mapTopicalAssignments } from '@/services/topicalAudit/mapping';
import { auditContentLinks } from '@/services/topicalAudit/content';
import { page, topic } from './fixtures/semanticAuditContracts';
import { auditContext } from './fixtures/topicalAuditContext';

describe('topical assignment and contextual link evidence', () => {
  it('keeps unique request and final aliases while rejecting ambiguous ownership', () => {
    const pages = [page('https://site.test/old', [], { final_url: 'https://site.test/new' }),
      page('https://site.test/a', [], { final_url: 'https://site.test/shared' }),
      page('https://site.test/b', [], { final_url: 'https://site.test/shared' })];
    const index = auditPageIndex(pages);
    expect(index.get('https://site.test/new')).toBe(pages[0]);
    expect(index.has('https://site.test/shared')).toBe(false);
    expect(index.get('https://site.test/a')).toBe(pages[1]);
  });

  it('retains measured topic assignments, stale declarations and shared-page membership', () => {
    const pages = [page('https://site.test/a', ['coffee'])];
    const nodes = [topic(['https://site.test/a', 'https://site.test/missing']),
      { ...topic(['https://site.test/a']), id: 'second' }, { ...topic([]), id: 'unmapped' }];
    const context = auditContext(pages, nodes);
    const mappings = mapTopicalAssignments(context.document, pages, context.findings);
    expect(mappings.pagesByTopic.get('topic-coffee')).toEqual(pages);
    expect(mappings.topicsByPage.get(pages[0].url)).toEqual(nodes.slice(0, 2));
    expect(context.findings).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'stale-url-assignment', urls: ['https://site.test/missing'] }),
      expect.objectContaining({ code: 'unmapped-topic', topicId: 'unmapped', provenance: ['asserted', 'measured'] }),
    ]));
  });

  it('ignores external, self, unknown and empty targets and counts repeated sources once', () => {
    const pages = [page('https://site.test/source', [], { depth: 0, final_url: undefined,
      semantic_links: [
        ...[0, 1].map(() => ({ target_url: '/target', anchor_text: 'Target', is_internal: true })),
        { target_url: '/other', anchor_text: 'External', is_internal: false },
        { target_url: '/source', anchor_text: 'Self', is_internal: true },
        { target_url: '/missing', anchor_text: 'Unknown', is_internal: true },
        { target_url: '', anchor_text: 'Empty', is_internal: true },
      ] }), page('https://site.test/target', [], { depth: 1 }), page('https://site.test/other', [])];
    const context = auditContext(pages);
    expect(auditContentLinks(pages, false, context.findings)).toBe(1);
    expect(context.findings).toEqual([expect.objectContaining({ code: 'content-orphan-page', urls: [pages[2].url] })]);
  });

  it('returns unknown for incomplete or bounded snapshots and zero for an empty complete crawl', () => {
    expect(auditContentLinks([page('https://site.test/', [])], true, [])).toBeNull();
    expect(auditContentLinks([{ ...page('https://site.test/', []), semantic_links: undefined }], false, [])).toBeNull();
    expect(auditContentLinks([], false, [])).toBe(0);
  });
});
