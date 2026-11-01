import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_SEMANTIC_SETTINGS, isSemanticSettings, loadSemanticSet, pageTexts, readSemanticSettings, saveSemanticSettings, semanticCache,
  MAX_PAGE_TEXT_CHARS, type TextPage,
} from '@/services/semanticSource';

const page = (url: string, extra: Record<string, unknown> = {}): TextPage => ({ url, title: `T ${url}`, ...extra });
const on = { ...DEFAULT_SEMANTIC_SETTINGS, enabled: true };
const provider = (embed = vi.fn(async (texts: string[]) => texts.map((_, i) => Float64Array.from([1, i + 1])))) => ({ id: 'fake', model: 'm', embed });

beforeEach(() => { localStorage.clear(); semanticCache.clearProject('p1'); semanticCache.clearProject('p2'); });

describe('semantic settings', () => {
  it('defaults off, round-trips and validates bounds', () => {
    expect(readSemanticSettings()).toEqual(DEFAULT_SEMANTIC_SETTINGS);
    expect(saveSemanticSettings(on).ok).toBe(true);
    expect(readSemanticSettings().enabled).toBe(true);
    expect(isSemanticSettings({ ...on, timeoutMs: 10 })).toBe(false);
    expect(isSemanticSettings({ ...on, maxEntries: 0 })).toBe(false);
    expect(isSemanticSettings({ ...on, provider: 'cloud' })).toBe(false);
    expect(isSemanticSettings({ ...on, model: ' ' })).toBe(false);
    expect(isSemanticSettings(null)).toBe(false);
    expect(isSemanticSettings({ ...on, enabled: 'yes' })).toBe(false);
  });

  it('returns failed write when storage rejects', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('denied'); });
    expect(saveSemanticSettings(on).ok).toBe(false);
    vi.restoreAllMocks();
  });
});

describe('pageTexts', () => {
  it('joins title, first h1 and meta, trims, bounds and keys by final url', () => {
    const texts = pageTexts([
      page('https://a.pl/x/', { final_url: 'https://a.pl/y', heading_texts: { h1: ['H one', 'H two'] }, meta_description: ' meta ' }),
      { url: 'https://a.pl/empty', title: '  ' },
      page('https://a.pl/long', { meta_description: 'z'.repeat(MAX_PAGE_TEXT_CHARS * 2) }),
      { url: 'https://a.pl/null', title: null, meta_description: null, heading_texts: null },
    ]);
    expect(texts.size).toBe(2);
    expect([...texts.values()][0]).toBe('T https://a.pl/x/. H one. meta');
    expect([...texts.values()][1]).toHaveLength(MAX_PAGE_TEXT_CHARS);
  });
});

describe('loadSemanticSet', () => {
  it('is off when disabled or when no page has text', async () => {
    expect(await loadSemanticSet({ settings: DEFAULT_SEMANTIC_SETTINGS, projectId: 'p1', pages: [page('https://a.pl/')] })).toEqual({ status: 'off' });
    expect(await loadSemanticSet({ settings: on, projectId: 'p1', pages: [] })).toEqual({ status: 'off' });
  });

  it('embeds once per project and reuses the session cache', async () => {
    const embed = vi.fn(async (texts: string[]) => texts.map((_, i) => Float64Array.from([1, i + 1])));
    const input = { settings: on, projectId: 'p1', pages: [page('https://a.pl/'), page('https://a.pl/b')], providerFor: () => provider(embed) };
    const first = await loadSemanticSet(input);
    expect(first.status === 'ready' && first.set.byUrl?.size).toBe(2);
    await loadSemanticSet(input);
    expect(embed).toHaveBeenCalledTimes(1);
    await loadSemanticSet({ ...input, projectId: 'p2' });
    expect(embed).toHaveBeenCalledTimes(2);
  });

  it('passes the corpus to the provider factory', async () => {
    const providerFor = vi.fn((_settings: unknown, _corpus: string[]) => provider());
    await loadSemanticSet({ settings: on, projectId: 'p1', pages: [page('https://a.pl/')], providerFor });
    expect(providerFor).toHaveBeenCalledWith(on, ['T https://a.pl/']);
  });

  it('falls back with a classified error when the provider fails', async () => {
    const failing = { id: 'f', model: 'm', embed: async () => { throw new Error('Cannot reach Ollama'); } };
    const result = await loadSemanticSet({ settings: on, projectId: 'p1', pages: [page('https://a.pl/')], providerFor: () => failing });
    expect(result).toMatchObject({ status: 'fallback', error: { code: 'offline' } });
  });

  it('falls back without an error when no usable vector comes back', async () => {
    const zero = { id: 'z', model: 'm', embed: async (texts: string[]) => texts.map(() => Float64Array.from([0, 0])) };
    const result = await loadSemanticSet({ settings: on, projectId: 'p1', pages: [page('https://a.pl/')], providerFor: () => zero });
    expect(result).toEqual({ status: 'fallback', error: null });
  });

  it('builds the real registry provider and degrades when Ollama is unreachable', async () => {
    const result = await loadSemanticSet({ settings: { ...on, ollamaUrl: 'http://127.0.0.1:9', timeoutMs: 1000 }, projectId: 'p1', pages: [page('https://a.pl/')] });
    expect(result.status).toBe('fallback');
    const hybrid = await loadSemanticSet({ settings: { ...on, provider: 'hybrid', ollamaUrl: 'http://127.0.0.1:9', timeoutMs: 1000 }, projectId: 'p1', pages: [page('https://a.pl/')] });
    expect(hybrid.status).toBe('fallback');
  });

  it('uses the default local Ollama address when none is configured', async () => {
    const fetchMock = vi.fn(async (_url: string) => { throw new Error('refused'); });
    vi.stubGlobal('fetch', fetchMock);
    const result = await loadSemanticSet({ settings: { ...on, timeoutMs: 1000 }, projectId: 'p1', pages: [page('https://a.pl/')] });
    expect(result.status).toBe('fallback');
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('127.0.0.1:11434');
    vi.unstubAllGlobals();
  });
});
