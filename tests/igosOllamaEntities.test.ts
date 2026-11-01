// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { createOllamaEntityExtractor, OLLAMA_ENTITIES, OLLAMA_ENTITIES_UNAVAILABLE, OLLAMA_ENTITY_PROFILE, parseEntityReply } from '@/services/igos/ollamaEntities';
import { buildPhraseIgos } from '@/services/igos/phraseIgos';
import { buildPhraseIgosWithSettings } from '@/services/igos/phraseIgosProvider';
import type { TopTenCorpus } from '@/services/targetPhraseAudit/types';

const words = (prefix: string, n: number) => Array.from({ length: n }, (_, i) => `${prefix}${i % 7}`).join(' ');
const corpus: TopTenCorpus = {
  target: { url: 'https://me.test/', text: `${words('coffee', 90)} grinder`, wordCount: 100 },
  pages: [1, 2, 3].map((rank) => ({ rank, url: `https://c${rank}.test/`, fetchedAt: '2026-10-29T00:00:00Z', status: 200, text: words('coffee', 80) })),
  requested: 3,
};
const now = () => '2026-10-30T09:00:00Z';

describe('Ollama entity reply parsing', () => {
  it('keeps normalised multi-word entities from the first JSON array and drops the rest', () => {
    expect(parseEntityReply('Sure: ["World Health Organization", "world health organization", "Paris", 4, "x"] done')).toEqual(['world health organ']);
  });
  it('caps the list', () => {
    const many = JSON.stringify(Array.from({ length: 60 }, (_, i) => `Entity Name${String.fromCharCode(97 + (i % 26))}${String.fromCharCode(97 + Math.floor(i / 26))}`));
    expect(parseEntityReply(many).length).toBeLessThanOrEqual(OLLAMA_ENTITY_PROFILE.maxEntities);
  });
  it('throws without an array so callers can fall back', () => {
    expect(() => parseEntityReply('no list here')).toThrow('no entity list');
    expect(() => parseEntityReply('[1,2]')).not.toThrow();
  });
  it('bounds the prompt text', async () => {
    const generate = vi.fn().mockResolvedValue('[]');
    await createOllamaEntityExtractor(generate)('x'.repeat(OLLAMA_ENTITY_PROFILE.maxChars + 500));
    expect((generate.mock.calls[0][0] as string).length).toBeLessThan(OLLAMA_ENTITY_PROFILE.maxChars + 300);
  });
});

describe('IGOS with the optional entity extractor', () => {
  it('stays heuristic-only without an extractor', async () => {
    const report = await buildPhraseIgos(corpus, undefined, undefined, { now });
    expect(report?.limitations).not.toContain(OLLAMA_ENTITIES);
    expect(report?.limitations).not.toContain(OLLAMA_ENTITIES_UNAVAILABLE);
  });
  it('merges model entities and labels the run', async () => {
    const entityExtractor = vi.fn().mockResolvedValue(['espresso machin']);
    const report = await buildPhraseIgos(corpus, undefined, undefined, { now, entityExtractor });
    expect(entityExtractor).toHaveBeenCalledTimes(4);
    expect(report?.limitations).toContain(OLLAMA_ENTITIES);
    expect(report?.limitations).toContain('heuristic-entities');
  });
  it('falls back to the heuristic and says so when the model fails', async () => {
    const entityExtractor = vi.fn().mockRejectedValue(new Error('offline'));
    const report = await buildPhraseIgos(corpus, undefined, undefined, { now, entityExtractor });
    expect(report?.limitations).toContain(OLLAMA_ENTITIES_UNAVAILABLE);
    expect(report?.limitations).not.toContain(OLLAMA_ENTITIES);
  });
});

describe('setting-driven Ollama entities', () => {
  it('uses the label model as generator only when set', async () => {
    const makeGenerator = vi.fn().mockReturnValue(async () => '["Espresso Machine"]');
    const on = await buildPhraseIgosWithSettings(corpus, { provider: 'local', labelModel: ' llama3.2 ' }, { now }, undefined, makeGenerator);
    expect(makeGenerator).toHaveBeenCalledWith(expect.objectContaining({ model: 'llama3.2' }));
    expect(on?.limitations).toContain(OLLAMA_ENTITIES);
    makeGenerator.mockClear();
    const off = await buildPhraseIgosWithSettings(corpus, { provider: 'local', labelModel: '  ' }, { now }, undefined, makeGenerator);
    expect(makeGenerator).not.toHaveBeenCalled();
    expect(off?.limitations).not.toContain(OLLAMA_ENTITIES);
    const own = vi.fn().mockResolvedValue([]);
    await buildPhraseIgosWithSettings(corpus, { provider: 'local', labelModel: 'm' }, { now, entityExtractor: own }, undefined, makeGenerator);
    expect(own).toHaveBeenCalled();
    expect(makeGenerator).not.toHaveBeenCalled();
  });
});
