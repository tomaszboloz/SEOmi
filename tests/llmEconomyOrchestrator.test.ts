import { beforeEach, describe, expect, it, vi } from 'vitest';
import { executeWithEconomy } from '@/services/llmEconomy/orchestrator';
import { clearExactCache } from '@/services/llmEconomy/semanticCache';
import { readLlmSpend, writeLlmBudget } from '@/services/llmEconomy/llmBudget';

const P = 'proj_orch_test';
const oct = new Date(2026, 9, 16);

beforeEach(() => {
  localStorage.clear();
  clearExactCache();
});

describe('executeWithEconomy orchestrator', () => {
  it('throws error when no provider is configured', async () => {
    await expect(executeWithEconomy({ projectId: P, configuredProviders: [], prompt: 'p', run: async () => ({ text: '' }) }))
      .rejects.toThrow('No AI provider configured');
  });

  it('runs with explicit providerId and custom model', async () => {
    const res = await executeWithEconomy({
      projectId: P, configuredProviders: ['openai'], providerId: 'gemini', model: 'gemini-1.5-pro', prompt: 'p1',
      run: async (provider) => ({ text: `provider=${provider}`, actualCostUsd: 0.05 }), now: oct,
    });
    expect(res.providerId).toBe('gemini');
    expect(res.model).toBe('gemini-1.5-pro');
    expect(res.costUsd).toBe(0.05);
  });

  it('falls back to estimatedCostUsd when actualCostUsd is not provided by runner', async () => {
    const res = await executeWithEconomy({
      projectId: P, configuredProviders: ['openai'], prompt: 'p2', estimatedCostUsd: 0.04,
      run: async () => ({ text: 'est' }), now: oct,
    });
    expect(res.costUsd).toBe(0.04);
  });

  it('runs with default model and default now when omitted', async () => {
    const res = await executeWithEconomy({ projectId: P, configuredProviders: ['ollama'], prompt: 'p3', run: async () => ({ text: 'ok' }) });
    expect(res.model).toBe('default');
    expect(res.text).toBe('ok');
  });

  it('respects custom batchThreshold and falls back to zero cost when cost is undefined', async () => {
    const res = await executeWithEconomy({
      projectId: P, configuredProviders: ['openai', 'ollama'], batchSize: 10, batchThreshold: 5, prompt: 'p4',
      run: async () => ({ text: 'ok' }), now: oct,
    });
    expect(res.providerId).toBe('ollama');
    expect(res.costUsd).toBe(0);
  });

  it('falls back to actualCostUsd from options when run does not return it and handles zero cost', async () => {
    const res = await executeWithEconomy({
      projectId: P, configuredProviders: ['openai'], prompt: 'p5', actualCostUsd: 0.03, run: async () => ({ text: 'ok' }), now: oct,
    });
    expect(res.costUsd).toBe(0.03);

    const zero = await executeWithEconomy({
      projectId: P, configuredProviders: ['openai'], prompt: 'p5-zero', run: async () => ({ text: 'zero' }), now: oct,
    });
    expect(zero.costUsd).toBeNull();
  });

  it('prefers local provider for large batches', async () => {
    const res = await executeWithEconomy({
      projectId: P, configuredProviders: ['openai', 'ollama'], batchSize: 100, prompt: 'p6', run: vi.fn().mockResolvedValue({ text: 'ok' }), now: oct,
    });
    expect(res.providerId).toBe('ollama');
    expect(res.leavesDevice).toBe(false);
    expect(res.costUsd).toBe(0);
  });

  it('blocks execution when project budget is exceeded', async () => {
    writeLlmBudget(P, { monthlyLimitUsd: 1, warnAtPercent: 80 });
    await executeWithEconomy({ projectId: P, configuredProviders: ['openai'], prompt: 'c1', estimatedCostUsd: 0.9, actualCostUsd: 0.9, run: async () => ({ text: '1' }), now: oct });
    await expect(executeWithEconomy({ projectId: P, configuredProviders: ['openai'], prompt: 'c2', estimatedCostUsd: 0.2, run: async () => ({ text: '2' }), now: oct }))
      .rejects.toThrow('Project LLM budget exceeded');
  });

  it('serves identical tasks from cache at zero cost and records savings', async () => {
    const runner = vi.fn().mockResolvedValue({ text: 'cached' });
    const first = await executeWithEconomy({ projectId: P, configuredProviders: ['openai'], prompt: 'same', estimatedCostUsd: 0.05, actualCostUsd: 0.05, run: runner, now: oct });
    expect(first.cached).toBe(false);
    const second = await executeWithEconomy({ projectId: P, configuredProviders: ['openai'], prompt: 'same', estimatedCostUsd: 0.05, run: runner, now: oct });
    expect(second.cached).toBe(true);
    expect(second.costUsd).toBe(0);
    expect(second.savedUsd).toBe(0.05);
    expect(runner).toHaveBeenCalledTimes(1);
    const spend = readLlmSpend(P, oct);
    expect(spend.cacheHits).toBe(1);
  });

  it('enforces deterministic YMYL gate on both cache miss and cache hit', async () => {
    const ymylFail = await executeWithEconomy({
      projectId: P, configuredProviders: ['openai'], prompt: 'med-fail', ymyl: true, sources: ['Intake is 100 mg.'],
      run: async () => ({ text: 'Take 900 mg.' }), now: oct,
    });
    expect(ymylFail.factGatePassed).toBe(false);
    expect(ymylFail.rejectedClaims).toContain('900mg');
    expect(ymylFail.needsHumanApproval).toBe(true);

    const ymylPass = await executeWithEconomy({
      projectId: P, configuredProviders: ['openai'], prompt: 'med-pass', ymyl: true, sources: ['Intake is 100 mg.'],
      run: async () => ({ text: 'Take 100 mg.' }), now: oct,
    });
    expect(ymylPass.factGatePassed).toBe(true);
    expect(ymylPass.needsHumanApproval).toBe(true);

    // Cache hit with YMYL
    const cachedHit = await executeWithEconomy({
      projectId: P, configuredProviders: ['openai'], prompt: 'med-pass', ymyl: true, sources: ['Intake is 100 mg.'],
      run: async () => ({ text: 'Different' }), now: oct,
    });
    expect(cachedHit.cached).toBe(true);
    expect(cachedHit.factGatePassed).toBe(true);
    expect(cachedHit.needsHumanApproval).toBe(true);

    // Omitted sources on miss and cache hit
    const missNoSrc = await executeWithEconomy({
      projectId: P, configuredProviders: ['openai'], prompt: 'no-src', ymyl: true,
      run: async () => ({ text: 'Take 50 mg daily.' }), now: oct,
    });
    expect(missNoSrc.factGatePassed).toBe(false);

    const hitNoSrc = await executeWithEconomy({
      projectId: P, configuredProviders: ['openai'], prompt: 'med-fail', ymyl: true,
      run: async () => ({ text: 'ignored' }), now: oct,
    });
    expect(hitNoSrc.cached).toBe(true);
    expect(hitNoSrc.factGatePassed).toBe(false);
  });
});
