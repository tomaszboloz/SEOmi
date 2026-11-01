import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SPRS_EMBEDDING_PROFILE, useSprsEmbeddings } from '@/components/Charts/semanticTopical/useSprsEmbeddings';
import type { EmbeddingProvider } from '@/services/embeddings/types';
import type { CrawledPageSummary } from '@/types';

const page = (url: string, extra: object = {}) => ({ url, final_url: url, title: 'T', semantic_terms: ['a', 'b'], semantic_excerpts: ['x'], ...extra }) as unknown as CrawledPageSummary;
const pages = [page('https://a.test/', { final_url: '' }), page('https://a.test/b/', { final_url: 'https://a.test/b/' })];
const settings = (patch: object) => localStorage.setItem('seomi_project_p1_embedding_clustering_v1', JSON.stringify({ provider: 'ollama', threshold: null, ollamaModel: 'embed-m', labelModel: '', ...patch }));
const vec = (...values: number[]) => Float64Array.from(values);
const provider = (embed: EmbeddingProvider['embed']): EmbeddingProvider => ({ id: 'ollama', model: 'embed-m', dimensions: 2, embed } as unknown as EmbeddingProvider);

beforeEach(() => localStorage.clear());

describe('opt-in SPRS embeddings (#71, #86)', () => {
  it('stays off for the local provider, without a project and without pages', () => {
    const factory = vi.fn();
    settings({ provider: 'local' });
    expect(renderHook(() => useSprsEmbeddings('p1', pages, factory)).result.current).toBeUndefined();
    settings({});
    expect(renderHook(() => useSprsEmbeddings(null, pages, factory)).result.current).toBeUndefined();
    expect(renderHook(() => useSprsEmbeddings('p1', [], factory)).result.current).toBeUndefined();
    expect(factory).not.toHaveBeenCalled();
  });
  it('builds page vectors keyed by normalized URL with the project model', async () => {
    settings({ ollamaModel: ' embed-m ' });
    const embed = vi.fn(async (texts: string[]) => texts.map((_, i) => vec(1, i)));
    const factory = vi.fn(() => provider(embed));
    const { result } = renderHook(() => useSprsEmbeddings('p1', pages, factory));
    await waitFor(() => expect(result.current).toBeDefined());
    expect(factory).toHaveBeenCalledWith(expect.objectContaining({ provider: 'ollama', ollamaModel: 'embed-m' }));
    expect([...(result.current?.byUrl?.keys() ?? [])].sort()).toEqual(['https://a.test/', 'https://a.test/b']);
    expect(embed.mock.calls[0][0][0]).toBe('T a b x');
  });
  it('bounds the page text and falls back to the provider default model', async () => {
    settings({ ollamaModel: '  ' });
    const embed = vi.fn(async (texts: string[]) => texts.map(() => vec(1, 0)));
    const factory = vi.fn(() => provider(embed));
    const longPages = [page('https://a.test/long', { title: undefined, semantic_terms: undefined, semantic_excerpts: ['y'.repeat(SPRS_EMBEDDING_PROFILE.maxChars * 2)] })];
    const { result } = renderHook(() => useSprsEmbeddings('p1', longPages, factory));
    await waitFor(() => expect(result.current).toBeDefined());
    expect(factory).toHaveBeenCalledWith(expect.objectContaining({ ollamaModel: undefined }));
    expect(embed.mock.calls[0][0][0].length).toBe(SPRS_EMBEDDING_PROFILE.maxChars);
    const barePages = [page('https://a.test/bare', { semantic_excerpts: undefined })];
    renderHook(() => useSprsEmbeddings('p1', barePages, factory));
    await waitFor(() => expect(embed.mock.calls.length).toBe(2));
    expect(embed.mock.calls[1][0][0]).toBe('T a b');
  });
  it('keeps the lexical path when the provider fails, is empty, or the view unmounts', async () => {
    settings({});
    const failing = vi.fn(() => provider(async () => { throw new Error('offline'); }));
    const failed = renderHook(() => useSprsEmbeddings('p1', pages, failing));
    await waitFor(() => expect(failing).toHaveBeenCalled());
    expect(failed.result.current).toBeUndefined();
    const empty = vi.fn(() => provider(async (texts) => texts.map(() => vec(0, 0))));
    const none = renderHook(() => useSprsEmbeddings('p1', pages, empty));
    await waitFor(() => expect(empty).toHaveBeenCalled());
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(none.result.current).toBeUndefined();
    let release: (value: Float64Array[]) => void = () => undefined;
    const slow = vi.fn(() => provider(() => new Promise<Float64Array[]>((resolve) => { release = resolve; })));
    const pending = renderHook(() => useSprsEmbeddings('p1', pages, slow));
    await waitFor(() => expect(slow).toHaveBeenCalled());
    pending.unmount();
    release([vec(1, 0), vec(1, 0)]);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(pending.result.current).toBeUndefined();
  });
});
