import { describe, expect, it, vi } from 'vitest';
import { auditPageSimilarity } from '@/services/topicalAudit/similarity';
import * as evidence from '@/services/topicalAudit/evidence';
import { page, topic } from './fixtures/semanticAuditContracts';
import { auditContext } from './fixtures/topicalAuditContext';

describe('bounded duplicate and lexical overlap review evidence', () => {
  it('gives exact content hashes measured risk evidence and preserves shared topic identity', () => {
    const pages = [page('https://site.test/a', ['coffee'], { content_hash: 'same' }),
      page('https://site.test/b', ['coffee'], { content_hash: 'same' })];
    const context = auditContext(pages, [topic(pages.map((entry) => entry.url))]);
    expect(auditPageSimilarity(context)).toBe(false);
    expect(context.findings).toEqual([expect.objectContaining({
      code: 'near-duplicate-content', severity: 'risk', confidence: 'moderate', topicId: 'topic-coffee',
      urls: ['https://site.test/a', 'https://site.test/b'], provenance: ['measured', 'derived'],
    })]);
  });

  it('keeps SimHash similarity limited and distinct from topical overlap', () => {
    const pages = [page('https://site.test/a', [], { content_simhash: '0000000000000000' }),
      page('https://site.test/b', [], { content_simhash: '000000000000007f' })];
    const context = auditContext(pages);
    expect(auditPageSimilarity(context)).toBe(false);
    expect(context.findings).toEqual([expect.objectContaining({
      code: 'near-duplicate-content', severity: 'review', confidence: 'limited', topicId: undefined,
    })]);
  });

  it('reports lexical overlap only for the shared editorial topic with enough shared terms', () => {
    const pages = [page('https://site.test/a', ['coffee', 'beans', 'grinder']),
      page('https://site.test/b', ['coffee', 'beans', 'grinder'])];
    const context = auditContext(pages, [topic(pages.map((entry) => entry.url))]);
    expect(auditPageSimilarity(context)).toBe(false);
    expect(context.findings).toEqual([expect.objectContaining({
      code: 'possible-url-overlap', confidence: 'limited', topicId: 'topic-coffee',
      provenance: ['asserted', 'measured', 'derived'],
    })]);
    const unrelated = auditContext(pages);
    auditPageSimilarity(unrelated);
    expect(unrelated.findings).toEqual([]);
  });

  it('does not accept eight changed bits or malformed fingerprints as near-duplicate evidence', () => {
    const pages = [page('https://site.test/a', [], { content_simhash: '0000000000000000' }),
      page('https://site.test/b', [], { content_simhash: '00000000000000ff' })];
    const context = auditContext(pages);
    context.topicsByPage.clear();
    expect(auditPageSimilarity(context)).toBe(false);
    expect(context.findings).toEqual([]);
  });

  it('keeps bounded comparisons and findings explicit for a large exact-duplicate group', () => {
    const pages = Array.from({ length: 708 }, (_, index) => page(`https://site.test/${index}`, [], { content_hash: 'same' }));
    const context = auditContext(pages);
    expect(auditPageSimilarity(context)).toBe(true);
    expect(context.findings).toHaveLength(500);
    expect(context.findings.every((finding) => finding.code === 'near-duplicate-content')).toBe(true);
  });

  it('does not compute discarded fingerprints when earlier stages exhausted the finding budget', () => {
    const pages = [page('https://site.test/a', [], { content_simhash: '0000000000000000' }),
      page('https://site.test/b', [], { content_simhash: '000000000000007f' })];
    const context = auditContext(pages);
    for (let index = 0; index < 500; index += 1) evidence.addFinding(context.findings, {
      id: String(index), code: 'unmapped-topic', severity: 'review', provenance: ['asserted'],
      title: 'Existing review', detail: 'Earlier audit stage', urls: [], evidence: [], confidence: 'limited',
    });
    const distance = vi.spyOn(evidence, 'hammingDistance');
    try {
      expect(auditPageSimilarity(context)).toBe(false);
      expect(context.findings).toHaveLength(500);
      expect(distance).not.toHaveBeenCalled();
    } finally {
      distance.mockRestore();
    }
  });
});
