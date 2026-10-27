import { describe, expect, it } from 'vitest';
import {
  extractValues, findCached, gateFacts, isLocalProvider, leavesDevice, pickBatchProvider, summarizeUsage, withinBudget,
} from '@/services/llmEconomy';

describe('gateFacts', () => {
  const source = 'Adults take paracetamol 500 mg every six hours. Daily maximum is 4 g.';
  it('rejects an invented dose and keeps the supported one', () => {
    const out = gateFacts('Take 500 mg every six hours. Take 5000 mg at once. Rest well.', [source]);
    expect(out.accepted).toEqual(['Take 500 mg every six hours.', 'Rest well.']);
    expect(out.rejected).toEqual([{ sentence: 'Take 5000 mg at once.', reason: 'unsupported-value', values: ['5000mg'] }]);
    expect(out.needsHumanApproval).toBe(true);
  });
  it('rejects valued sentences when no source exists', () => {
    expect(gateFacts('Dose is 10 mg.', []).rejected[0].reason).toBe('no-source');
  });
  it('normalises decimal commas and spacing', () => {
    expect(extractValues('Rate 2,5 % and 100 PLN')).toEqual(['2.5%', '100pln']);
    expect(gateFacts('Rate is 2.50%.', ['Interest 2,5%']).rejected).toEqual([]);
  });
});

describe('semantic cache', () => {
  const history = [
    { vector: [1, 0], response: 'a', costUsd: 0.02 },
    { vector: [0.9, 0.1], response: 'b', costUsd: 0.03 },
    { vector: [1, 0, 0], response: 'c', costUsd: 1 },
  ];
  it('returns the closest entry above the threshold', () => {
    expect(findCached([1, 0.01], history)?.entry.response).toBe('a');
  });
  it('misses below the threshold or on dimension mismatch', () => {
    expect(findCached([0, 1], history)).toBeNull();
    expect(findCached([1, 0, 0, 0], history)).toBeNull();
  });
});

describe('cost meter', () => {
  const entries = [
    { costUsd: 0.5, cached: false, local: false },
    { costUsd: 0.2, cached: true, local: false },
    { costUsd: 0.3, cached: false, local: true },
  ];
  it('counts spend, savings and cache hits', () => {
    expect(summarizeUsage(entries, 1)).toEqual({ spentUsd: 0.5, savedUsd: 0.5, cacheHits: 1, calls: 3, remainingUsd: 0.5, overBudget: false });
  });
  it('flags overspend and ignores invalid rows', () => {
    const extra = [...entries, { costUsd: -1, cached: false, local: false }, { costUsd: 2, cached: false, local: false }];
    const out = summarizeUsage(extra, 1);
    expect(out.overBudget).toBe(true);
    expect(out.remainingUsd).toBe(0);
    expect(summarizeUsage(entries, null).remainingUsd).toBeNull();
  });
  it('guards the next call', () => {
    expect(withinBudget(entries, 1, 0.6)).toBe(false);
    expect(withinBudget(entries, 1, 0.5)).toBe(true);
    expect(withinBudget(entries, null, 99)).toBe(true);
  });
  it('prefers local for big batches and warns for remote', () => {
    expect(pickBatchProvider(['openai', 'ollama'], 100)).toBe('ollama');
    expect(pickBatchProvider(['openai', 'ollama'], 3)).toBe('openai');
    expect(pickBatchProvider([], 100)).toBeNull();
    expect(isLocalProvider(' Ollama ')).toBe(true);
    expect(leavesDevice('openai')).toBe(true);
    expect(leavesDevice('vllm')).toBe(false);
    expect(leavesDevice('')).toBe(false);
  });
});
