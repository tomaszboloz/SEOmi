import { beforeEach, describe, expect, it } from 'vitest';
import {
  buildTaskKey, clearExactCache, clearProjectCache, exactCacheSize,
  findCached, findExactCached, findProjectCachedTask, putExactCached,
  resolveCacheSavings, storeProjectTask,
} from '@/services/llmEconomy/semanticCache';

beforeEach(() => {
  clearExactCache();
});

describe('exact and semantic task cache branches', () => {
  it('builds canonical task keys regardless of whitespace', () => {
    const key1 = buildTaskKey(' OpenAI ', 'gpt-4o', 'Summarize this page.');
    const key2 = buildTaskKey('openai', 'gpt-4o', 'Summarize this page.');
    expect(key1).toBe(key2);
  });

  it('stores and retrieves cached task responses at zero cost', () => {
    const key = buildTaskKey('claude', 'sonnet', 'Prompt text');
    expect(findExactCached(key)).toBeNull();

    putExactCached(key, 'Cached response', 0.04);
    expect(exactCacheSize()).toBe(1);

    const hit = findExactCached(key);
    expect(hit?.response).toBe('Cached response');
    expect(hit?.costUsd).toBe(0.04);

    const resolved = resolveCacheSavings(hit!.costUsd);
    expect(resolved).toEqual({ costUsd: 0, savedUsd: 0.04, cached: true });
  });

  it('skips semantic candidates with mismatched model, dimensions, or empty query vector', () => {
    storeProjectTask('p1', 'openai', 'gpt-4o', 'Q1', 'Ans1', 0.02, [1, 0, 0]);
    storeProjectTask('p1', 'openai', 'claude-3', 'Q2', 'Ans2', 0.02, [1, 0, 0]); // different model
    storeProjectTask('p1', 'openai', 'gpt-4o', 'Q3', 'Ans3', 0.02, [1, 0]); // different vector length
    storeProjectTask('p1', 'openai', 'gpt-4o', 'Q4', 'Ans4', 0.02, undefined); // no vector

    expect(findProjectCachedTask('p1', 'gpt-4o', 'Different', [])).toBeNull();
    expect(findProjectCachedTask('p1', 'gpt-4o', 'Different', [0, 1, 0])).toBeNull(); // cosine < 0.95
    expect(findProjectCachedTask('p1', 'gpt-4o', 'Different', [0.99, 0.01, 0])?.record.response).toBe('Ans1');
  });

  it('evicts correctly per project and globally', () => {
    storeProjectTask('p1', 'openai', 'gpt-4o', 'k1', 'resp1', 0.01);
    storeProjectTask('p2', 'openai', 'gpt-4o', 'k2', 'resp2', 0.01);
    expect(exactCacheSize('p1')).toBe(1);
    expect(exactCacheSize()).toBe(2);

    clearProjectCache('p1');
    expect(exactCacheSize('p1')).toBe(0);
    expect(exactCacheSize('p2')).toBe(1);

    clearExactCache();
    expect(exactCacheSize()).toBe(0);
  });

  it('does not reuse a response across providers with the same model and prompt', () => {
    storeProjectTask('provider-scope', 'openai', 'same-model', 'same prompt', 'openai answer', 0.02, [1, 0]);
    expect(findProjectCachedTask('provider-scope', 'same-model', 'same prompt', undefined, undefined, 'claude')).toBeNull();
    expect(findProjectCachedTask('provider-scope', 'same-model', 'same prompt', undefined, undefined, 'openai')?.record.response).toBe('openai answer');
  });

  it('handles findCached edge cases with vector length mismatch', () => {
    const history = [{ vector: [1, 0, 0], response: 'a', costUsd: 0.01 }];
    expect(findCached([1, 0], history)).toBeNull();
  });

  it('handles plain keys without delimiters, null cost entries, and nonexistent project size', () => {
    expect(exactCacheSize('nonexistent-project')).toBe(0);
    putExactCached('simple-key', 'simple-response', 0.05);
    const hit = findExactCached('simple-key');
    expect(hit?.response).toBe('simple-response');
    expect(hit?.costUsd).toBe(0.05);

    storeProjectTask('default', '', '', 'null-cost-prompt', 'null-cost-resp', null);
    const nullCostHit = findExactCached('\u0000\u0000null-cost-prompt');
    expect(nullCostHit?.costUsd).toBe(0);
  });
});
