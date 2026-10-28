import { beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/i18n';
import { comparableRewrites, compareRewrite, makeRewriteEntry, readRewriteHistory, recordRewrite, rewritePassage } from '@/services/aioReadiness';
import { acceptRewriteIntoBrief } from '@/services/aioReadiness/acceptRewrite';
import { withOllamaFallback } from '@/services/aioReadiness/rewriteDeps';
import { createEmptyTopicalMap, createTopicalNode } from '@/services/topicalMap';

const chat = vi.hoisted(() => vi.fn());
const createChat = vi.hoisted(() => vi.fn(() => chat));
vi.mock('@/services/embeddings/ollamaChat', () => ({ createOllamaChat: createChat }));

const input = { url: 'https://s.test/p', title: 'Page', heading: 'Facts', revision: 'abc1', before: 'It is 10 kg.', after: 'The box weighs 10 kg.' };
const none = { isConfigured: () => false, generateText: vi.fn() };

beforeEach(async () => { localStorage.clear(); chat.mockReset(); createChat.mockClear(); await i18n.changeLanguage('en'); });

describe('accept rewrite into brief (GEM-64-07)', () => {
  it('creates a brief with a numbered draft version', () => {
    const result = acceptRewriteIntoBrief(createEmptyTopicalMap(), input, '2026-01-01T00:00:00Z');
    const brief = result.document.nodes[0].contentBrief;
    expect(result.nodeId).toBe(result.document.nodes[0].id);
    expect(brief.draftMarkdown).toContain('The box weighs 10 kg.');
    expect(brief.draftMarkdown).toContain('not verified');
    expect(brief.draftVersions).toHaveLength(1);
    expect(brief.draftVersions[0].note).toBe(result.versionNote);
    expect(result.versionNote).toContain('abc1');
  });

  it('replaces the same revision instead of duplicating, and keeps earlier versions', () => {
    const first = acceptRewriteIntoBrief(createEmptyTopicalMap(), input, '2026-01-01T00:00:00Z');
    const again = acceptRewriteIntoBrief(first.document, { ...input, after: 'Edited 10 kg.' }, '2026-01-02T00:00:00Z');
    const brief = again.document.nodes[0].contentBrief;
    expect(again.document.nodes).toHaveLength(1);
    expect(brief.draftMarkdown.match(/seomi-aio-rewrite:abc1:start/g)).toHaveLength(1);
    expect(brief.draftMarkdown).toContain('Edited 10 kg.');
    expect(brief.draftMarkdown).not.toContain('The box weighs');
    expect(brief.draftVersions).toHaveLength(2);
  });

  it('appends to an existing brief without touching its text', () => {
    const node = createTopicalNode('Existing');
    node.sourceUrls = [input.url];
    node.contentBrief.draftMarkdown = 'Hand written intro.';
    const result = acceptRewriteIntoBrief({ ...createEmptyTopicalMap(), nodes: [node] }, input);
    expect(result.document.nodes[0].contentBrief.draftMarkdown.startsWith('Hand written intro.\n\n')).toBe(true);
  });

  it('refuses when the node limit or draft limit is hit', () => {
    const nodes = Array.from({ length: 300 }, () => createTopicalNode('x'));
    expect(acceptRewriteIntoBrief({ ...createEmptyTopicalMap(), nodes }, input).nodeId).toBeNull();
    const big = createTopicalNode('Big');
    big.sourceUrls = [input.url];
    big.contentBrief.draftMarkdown = 'x'.repeat(50_000);
    expect(acceptRewriteIntoBrief({ ...createEmptyTopicalMap(), nodes: [big] }, input).nodeId).toBeNull();
  });
});

describe('Ollama path for rewrite (GEM-64-03)', () => {
  it('keeps the cloud provider when connected', () => {
    const cloud = { isConfigured: () => true, generateText: vi.fn() };
    expect(withOllamaFallback(cloud, 'p1')).toBe(cloud);
  });

  it('falls back to the saved project Ollama model and rewrites through it', async () => {
    localStorage.setItem('seomi_project_p1_ollama_assistant_model_v1', 'llama3');
    chat.mockResolvedValue({ text: 'The box weighs 10 kg.' });
    const deps = withOllamaFallback(none, 'p1');
    expect(createChat).toHaveBeenCalledWith(expect.objectContaining({ model: 'llama3', baseUrl: 'http://127.0.0.1:11434' }));
    expect(await rewritePassage(deps, { heading: 'Facts', text: 'It is 10 kg.', issues: [] })).toEqual({ status: 'ok', text: 'The box weighs 10 kg.' });
    expect(chat).toHaveBeenCalledWith([{ role: 'user', content: expect.stringContaining('untrusted') }]);
  });

  it('reports no-key without a project, a model, or when Ollama fails', async () => {
    expect(withOllamaFallback(none, null)).toBe(none);
    expect(withOllamaFallback(none, 'p1')).toBe(none);
    localStorage.setItem('seomi_project_p1_ollama_assistant_model_v1', 'llama3');
    chat.mockRejectedValue(new Error('Cannot reach Ollama'));
    const outcome = await rewritePassage(withOllamaFallback(none, 'p1'), { heading: '', text: 'x', issues: [] });
    expect(outcome).toEqual({ status: 'error', message: 'Cannot reach Ollama' });
  });
});

describe('comparable rewrite history (GEM-64-08)', () => {
  it('separates entries scored by a different profile config', () => {
    const review = compareRewrite('It is 10 kg.', 'The box weighs 10 kg.', 'Facts');
    recordRewrite('p1', makeRewriteEntry('r1', review, '2026-01-01T00:00:00Z'));
    recordRewrite('p1', { ...makeRewriteEntry('r1', review, '2026-01-02T00:00:00Z'), configHash: 'other' });
    recordRewrite('p1', makeRewriteEntry('r2', review));
    recordRewrite('bad id', makeRewriteEntry('r3', review));
    const history = readRewriteHistory('p1');
    expect(history).toHaveLength(3);
    const view = comparableRewrites(history, 'r1', review.before.profile.configHash);
    expect(view.comparable).toHaveLength(1);
    expect(view.other).toBe(1);
  });

  it('ignores malformed storage', () => {
    localStorage.setItem('seomi_project_p1_aio_rewrite_history_v1', JSON.stringify([{ nope: 1 }, 'x']));
    expect(readRewriteHistory('p1')).toEqual([]);
    expect(readRewriteHistory(null)).toEqual([]);
  });
});
