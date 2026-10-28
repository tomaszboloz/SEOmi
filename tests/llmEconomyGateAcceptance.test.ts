import { beforeEach, describe, expect, it, vi } from 'vitest';
import { executeWithEconomy } from '@/services/llmEconomy/orchestrator';
import { clearExactCache, findProjectCachedTask } from '@/services/llmEconomy/semanticCache';
import { readLlmStorageState, writeLlmBudget } from '@/services/llmEconomy/llmBudget';

const projectId = 'llm-gate-acceptance';
const now = new Date('2026-10-27T12:00:00.000Z');

beforeEach(() => {
  localStorage.clear();
  clearExactCache();
});

describe('LLM economy acceptance gates', () => {
  it('revalidates YMYL for a caller joining an ordinary in-flight request', async () => {
    let release!: (value: { text: string; actualCostUsd: number }) => void;
    const run = vi.fn(() => new Promise<{ text: string; actualCostUsd: number }>((resolve) => { release = resolve; }));
    const ordinary = executeWithEconomy({ projectId, configuredProviders: ['openai'], prompt: 'same task', estimatedCostUsd: 0.1, run, now });
    const strict = executeWithEconomy({
      projectId, configuredProviders: ['openai'], prompt: 'same task', ymyl: true,
      sources: [{ sourceId: 'review-1', text: 'Approved dose is 100 mg.', reviewedBy: 'alice', reviewedAt: now.toISOString() }],
      estimatedCostUsd: 0.1, run, now,
    });
    release({ text: 'Take 900 mg.', actualCostUsd: 0.1 });
    await expect(ordinary).resolves.toMatchObject({ text: 'Take 900 mg.', factGatePassed: true });
    await expect(strict).resolves.toMatchObject({ text: '', factGatePassed: false, cached: false, rejectedClaims: ['900mg'] });
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('does not cache a rejected YMYL response and never returns its text', async () => {
    const run = vi.fn().mockResolvedValue({ text: 'Take 900 mg.', actualCostUsd: 0.1 });
    const result = await executeWithEconomy({
      projectId, configuredProviders: ['openai'], prompt: 'rejected task', ymyl: true,
      sources: [{ sourceId: 'review-1', text: 'Approved dose is 100 mg.', reviewedBy: 'alice', reviewedAt: now.toISOString() }],
      estimatedCostUsd: 0.1, run, now,
    });
    expect(result.text).toBe('');
    expect(result.factGatePassed).toBe(false);
    expect(findProjectCachedTask(projectId, 'default', 'rejected task', undefined, undefined, 'openai', now.getTime())).toBeNull();
  });

  it('fails closed for corrupt budget storage before a billable cloud call', async () => {
    writeLlmBudget(projectId, { monthlyLimitUsd: 1, warnAtPercent: 80 });
    localStorage.setItem(`seomi_project_${projectId}_llm_budget_v1`, '{broken');
    const run = vi.fn().mockResolvedValue({ text: 'should not run', actualCostUsd: 0.1 });
    await expect(executeWithEconomy({ projectId, configuredProviders: ['openai'], prompt: 'corrupt budget', estimatedCostUsd: 0.1, run, now }))
      .rejects.toThrow('budget storage');
    expect(run).not.toHaveBeenCalled();
    expect(readLlmStorageState(projectId).budget).toBe('invalid');
  });

  it('uses the declared adapter transport instead of trusting a local-looking provider id', async () => {
    const result = await executeWithEconomy({
      projectId, configuredProviders: ['ollama'], providerId: 'ollama', transport: 'cloud',
      prompt: 'adapter transport', estimatedCostUsd: 0.2,
      run: async () => ({ text: 'cloud answer', actualCostUsd: 0.2, transport: 'cloud' }), now,
    });
    expect(result.local).toBe(false);
    expect(result.leavesDevice).toBe(true);
    expect(result.costUsd).toBe(0.2);
  });

  it('rejects a forged local transport for a hosted provider id', async () => {
    await expect(executeWithEconomy({
      projectId, configuredProviders: ['openai'], providerId: 'openai', transport: 'local', prompt: 'forged local',
      run: async () => ({ text: 'must not run', transport: 'local' }), now,
    })).rejects.toThrow('known local provider');
  });
});
