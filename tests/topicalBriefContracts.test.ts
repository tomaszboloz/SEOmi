import { describe, expect, it } from 'vitest';
import { normalizeContentBrief, normalizeContentBriefVersion } from '@/services/topicalDocument/brief';
import { createEmptyContentBrief } from '@/services/topicalDocument/factories';

describe('topical editorial normalization', () => {
  it('rejects invalid version content and retains bounded checkpoints', () => {
    for (const value of [null, 1, {}, { draftMarkdown: ' ' }]) expect(normalizeContentBriefVersion(value)).toBeNull();
    expect(normalizeContentBriefVersion({ draftMarkdown: ' draft ' })).toMatchObject({ draftMarkdown: 'draft', savedAt: new Date(0).toISOString(), note: '' });
    expect(normalizeContentBriefVersion({ id: 'v', savedAt: 'now', note: ' note ', draftMarkdown: 'draft' }))
      .toEqual({ id: 'v', savedAt: 'now', note: 'note', draftMarkdown: 'draft' });
  });
  it('uses independent empty briefs for absent and scalar input', () => {
    expect(normalizeContentBrief(null)).toEqual(createEmptyContentBrief());
    expect(normalizeContentBrief(1)).toEqual(createEmptyContentBrief());
    expect(normalizeContentBrief({})).toEqual(createEmptyContentBrief());
  });
  it('bounds and deduplicates entity and link requirements', () => {
    const result = normalizeContentBrief({ requiredEntities: [' ', ...Array.from({ length: 90 }, (_, i) => `e${i}`), 'e0'],
      internalLinkTargets: ['javascript:alert(1)', ...Array.from({ length: 60 }, (_, i) => `https://site.test/${i}`)],
      draftVersions: [null, {}, ...Array.from({ length: 40 }, (_, i) => ({ id: `${i}`, draftMarkdown: 'd' }))] });
    expect(result.requiredEntities).toHaveLength(80);
    expect(result.internalLinkTargets).toHaveLength(50);
    expect(result.draftVersions).toHaveLength(28);
  });
  it('only verifies a source-backed paragraph with a valid source and explicit check', () => {
    const result = normalizeContentBrief({ targetQueryId: 'q', snippetTarget: 'faq', draftMarkdown: ' d ', paragraphReviews: [null, 1, {},
      { paragraph: 'a', treatment: 'source-backed', sourceUrl: 'https://site.test', sourceChecked: true },
      { paragraph: 'b', treatment: 'source-backed', sourceChecked: true },
      { paragraph: 'c', treatment: 'source-backed', sourceUrl: 'https://site.test', sourceChecked: false },
      { paragraph: 'd', treatment: 'editorial', sourceUrl: 'https://site.test', sourceChecked: true },
      { paragraph: 'e', treatment: 'invalid' }] });
    expect(result).toMatchObject({ targetQueryId: 'q', snippetTarget: 'faq', draftMarkdown: 'd' });
    expect(result.paragraphReviews.map((review) => review.sourceChecked)).toEqual([true, false, false, false, false]);
    expect(result.paragraphReviews.at(-1)?.treatment).toBe('unreviewed');
  });
});
