import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createProvider } from '@/services/embeddings/registry';
import { checkPrePublish } from '@/services/prePublish/embeddingCheck';
import { computeSfs } from '@/services/siteFocus/aggregate';
import { draftText, mockProvider, mountContext, vectorsFor } from './fixtures/prePublishMount';

vi.mock('@/services/embeddings/registry', async (original) => ({
  ...await original<typeof import('@/services/embeddings/registry')>(), createProvider: vi.fn(),
}));
const settings = { provider: 'ollama', ollamaModel: 'custom-model' };
const signal = () => new AbortController().signal;
beforeEach(() => { vi.clearAllMocks(); localStorage.clear(); mockProvider(); });
describe('pre-publish embedding integration', () => {
  it('embeds core, draft and crawl together using existing provider settings and original scores', async () => {
    const context = mountContext();
    context.pages[0].score = { ...context.pages[0].score, trs: 20, weight: 2 };
    const snapshot = JSON.stringify(context);
    const saved = { ...localStorage };
    const result = await checkPrePublish(draftText, '', context, settings, signal());
    const provider = vi.mocked(createProvider).mock.results[0].value;
    expect(createProvider).toHaveBeenCalledWith(expect.objectContaining({ ...settings,
      ollamaUrl: 'http://127.0.0.1:11434', corpus: [context.coreText, draftText.trim(), ...context.pages.map((page) => page.text)] }));
    expect(provider.embed).toHaveBeenCalledOnce();
    expect(result.sfsBefore).toBe(computeSfs(context.pages.map((page) => page.score)).score);
    expect(result.sfsAfter).toBe(computeSfs([...context.pages.map((page) => page.score),
      { trs: 90, weight: 1, type: 'article' }]).score);
    expect(result.conflicts).toHaveLength(3);
    expect(JSON.stringify(context)).toBe(snapshot);
    expect({ ...localStorage }).toEqual(saved);
  });
  it('replaces an existing URL, including its final URL alias, rather than duplicating it', async () => {
    const context = mountContext();
    context.pages[0].source = { ...context.pages[0].source, final_url: 'https://example.test/final' };
    for (const url of ['https://example.test/page-0', 'https://example.test/final#fragment']) {
      const result = await checkPrePublish(draftText, url, context, settings, signal());
      expect(result.conflicts.map((page) => page.url)).not.toContain(context.pages[0].score.url);
      expect(result.conflicts).toHaveLength(2);
      expect(result.sfsAfter).toBe(computeSfs([...context.pages.slice(1).map((page) => page.score),
        { trs: 90, weight: 1, type: 'article' }]).score);
    }
    context.pages[0].source = { ...context.pages[0].source, final_url: '' };
    expect((await checkPrePublish(draftText, 'https://example.test/new', context, settings, signal())).conflicts).toHaveLength(3);
  });
  it('returns existing insufficient reasons before contacting a provider', async () => {
    const context = mountContext();
    expect((await checkPrePublish(draftText, '', { ...context, coreText: '' }, settings, signal())).reasons).toEqual(['no-core']);
    expect((await checkPrePublish(draftText, '', { ...context, pages: [] }, settings, signal())).reasons).toEqual(['corpus-too-small']);
    expect(createProvider).not.toHaveBeenCalled();
  });
  it.each(['relative', 'file:///draft'])('rejects invalid URL %s', async (url) => {
    await expect(checkPrePublish(draftText, url, mountContext(), settings, signal())).rejects.toThrow('Invalid draft');
  });
  it('rejects empty drafts and propagates provider failure without fallback vectors', async () => {
    await expect(checkPrePublish(' ', '', mountContext(), settings, signal())).rejects.toThrow('Invalid draft');
    mockProvider(vi.fn().mockRejectedValue(new Error('offline')));
    await expect(checkPrePublish(draftText, '', mountContext(), settings, signal())).rejects.toThrow('offline');
  });
  it('passes paragraphs to the existing chunk checks and applies the default Ollama model', async () => {
    const result = await checkPrePublish(`${draftText}\n\nIt needs context.`, '', mountContext(),
      { provider: 'local', ollamaModel: ' ' }, signal());
    expect(createProvider).toHaveBeenCalledWith(expect.objectContaining({ provider: 'local', ollamaModel: undefined }));
    expect(result.chunkIssues).toEqual([{ index: 1, kind: 'leading-pronoun' }, { index: 1, kind: 'too-short' }]);
  });
  it.each(['dimensions', 'empty', 'zero', 'nan', 'missing', 'extra', 'model', 'provider'])('rejects incompatible %s vectors', async (kind) => {
    const provider = mockProvider(vi.fn(async (texts: string[]) => {
      const vectors = vectorsFor(texts);
      if (kind === 'dimensions') vectors[2] = new Float64Array([1, 0, 0]);
      if (kind === 'empty') vectors[0] = new Float64Array();
      if (kind === 'zero') vectors[1] = new Float64Array([0, 0]);
      if (kind === 'nan') vectors[1] = new Float64Array([NaN, 1]);
      if (kind === 'missing') vectors.pop();
      if (kind === 'extra') vectors.push(new Float64Array([1, 0]));
      if (kind === 'model') provider.model = 'changed-model';
      if (kind === 'provider') provider.id = 'changed-provider';
      return vectors;
    }));
    const result = await checkPrePublish(draftText, '', mountContext(), settings, signal());
    expect(result).toMatchObject({ verdict: 'insufficient', publishApproved: false,
      reasons: ['dimension-mismatch'], sfsBefore: null, sfsAfter: null, draftTrs: null });
  });
});
