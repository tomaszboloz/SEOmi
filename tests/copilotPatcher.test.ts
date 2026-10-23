import { describe, expect, it, vi } from 'vitest';
import { analyzeTarget, buildPatchPrompt, choosePatchProvider, decide, findDanglingPronouns, findSpoGaps, missingEntities, proposePatch, sanitizePatch } from '@/services/copilotPatcher';
import type { PatchTarget } from '@/services/copilotPatcher';

const target = (patch: Partial<PatchTarget> = {}): PatchTarget => ({
  h1: 'Creatine guide', h2: ['Dosage', 'Safety'], heading: 'Dosage',
  paragraph: 'It helps muscles. Creatine is taken daily. Take 5 g per day. The weather is nice today for everyone.',
  language: 'en', pageEntities: ['Creatine'], missingEntities: ['monohydrate', 'Creatine'], removeFragments: ['The weather is nice today for everyone.'], ...patch,
});

describe('copilot analysis', () => {
  it('flags a pronoun-opening first sentence only', () => {
    expect(findDanglingPronouns('It helps muscles. It is safe.', 'en')).toEqual([{ sentence: 'It helps muscles.', pronoun: 'it' }]);
    expect(findDanglingPronouns('To jest ważne. Ok.', 'pl-PL')).toHaveLength(1);
    expect(findDanglingPronouns('Creatine helps. It is safe.', 'en')).toEqual([]);
    expect(findDanglingPronouns('It helps.', 'de')).toEqual([]);
    expect(findDanglingPronouns('', 'en')).toEqual([]);
  });

  it('finds SPO gaps only when entities exist and the paragraph mentions one', () => {
    const text = 'Creatine is taken daily. The weather is nice today for everyone. Short one.';
    expect(findSpoGaps(text, ['Creatine'])).toEqual([{ sentence: 'The weather is nice today for everyone.' }]);
    expect(findSpoGaps(text, [])).toEqual([]);
    expect(findSpoGaps(text, ['Zinc'])).toEqual([]);
  });

  it('lists missing entities and combines analysis', () => {
    expect(missingEntities('Creatine here', ['creatine', 'monohydrate', ''])).toEqual(['monohydrate']);
    const result = analyzeTarget(target());
    expect(result.dangling).toHaveLength(1);
    expect(result.missing).toEqual(['monohydrate']);
    expect(result.spoGaps).toHaveLength(2);
  });
});

describe('copilot prompt', () => {
  it('contains page context, rules and findings', () => {
    const prompt = buildPatchPrompt(target());
    for (const part of ['Creatine guide', '"Dosage", "Safety"', 'Answer first', 'Do not add new numbers', 'monohydrate', 'Remove these fragments', 'open with a pronoun', 'Name the subject or object']) expect(prompt).toContain(part);
  });

  it('degrades cleanly without headings or findings', () => {
    const prompt = buildPatchPrompt(target({ h2: [], heading: null, paragraph: 'Creatine works.', missingEntities: [], removeFragments: [], language: '' }));
    expect(prompt).toContain('no heading');
    expect(prompt).toContain('language "en"');
    expect(prompt).not.toContain('Remove these');
  });
});

describe('copilot run', () => {
  const ok = (text: string) => ({ id: 'openai', generate: vi.fn(async () => text) });

  it('prefers a local provider and handles none', () => {
    expect(choosePatchProvider([ok('a'), { ...ok('b'), id: 'ollama' }])?.id).toBe('ollama');
    expect(choosePatchProvider([ok('a')])?.id).toBe('openai');
    return expect(proposePatch(target(), [])).resolves.toEqual({ ok: false, reason: 'no-provider' });
  });

  it('sanitizes output and drops unsupported amounts, leaving a pending proposal', async () => {
    const provider = { id: 'ollama', generate: vi.fn(async () => '```\n<b>Creatine helps muscles.</b> Take 5 g per day. Take 50 g per day.\n```') };
    const result = await proposePatch(target(), [provider]);
    expect(result.ok && result.proposal).toMatchObject({ status: 'pending', after: 'Creatine helps muscles. Take 5 g per day.', rejectedSentences: ['Take 50 g per day.'], leftDevice: false, fromCache: false });
    if (result.ok) {
      expect(decide(result.proposal, true).status).toBe('approved');
      expect(decide(result.proposal, false).status).toBe('rejected');
    }
  });

  it('caches by provider and prompt and flags remote providers', async () => {
    const cache = new Map<string, string>();
    const provider = ok('Creatine helps.');
    const first = await proposePatch(target(), [provider], { cache });
    const second = await proposePatch(target(), [provider], { cache });
    expect(provider.generate).toHaveBeenCalledTimes(1);
    expect(first.ok && first.proposal.leftDevice).toBe(true);
    expect(second.ok && second.proposal.fromCache).toBe(true);
  });

  it('reports abort, provider error, non-Error throw and empty responses', async () => {
    const controller = new AbortController();
    const slow = { id: 'x', generate: () => new Promise<string>(() => {}) };
    const pending = proposePatch(target(), [slow], { signal: controller.signal });
    controller.abort();
    expect(await pending).toEqual({ ok: false, reason: 'aborted' });
    expect(await proposePatch(target(), [slow], { signal: controller.signal })).toEqual({ ok: false, reason: 'aborted' });
    expect(await proposePatch(target(), [{ id: 'x', generate: async () => { throw new Error('boom'); } }])).toEqual({ ok: false, reason: 'provider-error', detail: 'boom' });
    expect(await proposePatch(target(), [{ id: 'x', generate: async () => { throw 'bad'; } }])).toMatchObject({ detail: 'bad' });
    expect(await proposePatch(target(), [ok('```  ```')])).toEqual({ ok: false, reason: 'empty-response' });
    expect(await proposePatch(target(), [ok('Take 99 mg now.')])).toEqual({ ok: false, reason: 'empty-response' });
    expect(sanitizePatch('"""\n a   b \n"""')).toBe('a b');
  });
});
