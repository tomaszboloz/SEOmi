import { beforeEach, describe, expect, it, vi } from 'vitest';
import { executeWithEconomy, type ExecuteOptions } from '@/services/llmEconomy/orchestrator';
import { clearExactCache } from '@/services/llmEconomy/semanticCache';
import { writeLlmBudget } from '@/services/llmEconomy/llmBudget';
import { applyPatch, type ApplyDeps } from '@/services/cmsPatch/apply';
import { planPatch } from '@/services/cmsPatch/plan';
import { memoryStore, mockCms, target } from './fixtures/cmsMock';

const oct = new Date(2026, 9, 25);

beforeEach(() => {
  localStorage.clear();
  clearExactCache();
  vi.restoreAllMocks();
});

const makeCmsDeps = () => {
  const cms = mockCms('wordpress');
  const store = memoryStore();
  const deps: ApplyDeps = {
    send: cms.send, store,
    ctx: { actor: 'auditor', role: 'developer', projectId: 'p_cms' },
    saveBackup: async () => {},
  };
  return { cms, deps };
};

describe('llmEconomy additional branch regressions', () => {
  it('enforces project budget limit independently per project', async () => {
    writeLlmBudget('proj-A', { monthlyLimitUsd: 1.0, warnAtPercent: 80 });
    writeLlmBudget('proj-B', { monthlyLimitUsd: 10.0, warnAtPercent: 80 });

    const baseOpts = (projectId: string, promptId: string, estimatedCostUsd: number): ExecuteOptions => ({
      projectId, configuredProviders: ['openai'], prompt: `prompt_${projectId}_${promptId}`,
      estimatedCostUsd, actualCostUsd: estimatedCostUsd,
      run: async () => ({ text: 'done', actualCostUsd: estimatedCostUsd }),
      now: oct,
    });

    await executeWithEconomy(baseOpts('proj-A', '1', 0.9));

    await expect(executeWithEconomy(baseOpts('proj-A', '2', 0.2)))
      .rejects.toThrow('Project LLM budget exceeded');

    const resB = await executeWithEconomy(baseOpts('proj-B', '1', 0.2));
    expect(resB.text).toBe('done');
    expect(resB.costUsd).toBe(0.2);
  });

  it('propagates null costUsd for external provider when price is unknown or absent', async () => {
    const res = await executeWithEconomy({
      projectId: 'proj-ext', configuredProviders: ['openai'], prompt: 'summarize',
      run: async () => ({ text: 'result' }),
      now: oct,
    });
    expect(res.leavesDevice).toBe(true);
    expect(res.local).toBe(false);
    expect((res as unknown as { costUsd: number | null }).costUsd).toBeNull();
  });

  it('preserves known actualCostUsd of 0 when explicitly reported', async () => {
    const res = await executeWithEconomy({
      projectId: 'proj-zero', configuredProviders: ['openai'], prompt: 'free-tier-check',
      actualCostUsd: 0,
      run: async () => ({ text: 'free-tier', actualCostUsd: 0 }),
      now: oct,
    });
    expect(res.leavesDevice).toBe(true);
    expect(res.local).toBe(false);
    expect(res.costUsd).toBe(0);
  });

  it('serves cache hit without invoking the underlying provider runner and costs 0', async () => {
    const runner = vi.fn().mockResolvedValue({ text: 'first response', actualCostUsd: 0.05 });
    const opts: ExecuteOptions = {
      projectId: 'proj-cache', configuredProviders: ['openai'], model: 'gpt-4o',
      prompt: 'repeated query', actualCostUsd: 0.05, run: runner, now: oct,
    };

    const first = await executeWithEconomy(opts);
    expect(first.cached).toBe(false);
    expect(runner).toHaveBeenCalledTimes(1);

    const second = await executeWithEconomy(opts);
    expect(second.cached).toBe(true);
    expect(second.costUsd).toBe(0);
    expect(second.savedUsd).toBe(0.05);
    expect(runner).toHaveBeenCalledTimes(1);
  });

  it('selects local provider for large batches and falls back to remote for small or unconfigured batches', async () => {
    const run = async () => ({ text: 'batch result' });

    const largeRes = await executeWithEconomy({
      projectId: 'proj-batch', configuredProviders: ['openai', 'ollama'],
      batchSize: 100, prompt: 'large batch', run, now: oct,
    });
    expect(largeRes.providerId).toBe('ollama');
    expect(largeRes.local).toBe(true);
    expect(largeRes.leavesDevice).toBe(false);

    const smallRes = await executeWithEconomy({
      projectId: 'proj-batch', configuredProviders: ['openai', 'ollama'],
      batchSize: 10, prompt: 'small batch', run, now: oct,
    });
    expect(smallRes.providerId).toBe('openai');
    expect(smallRes.leavesDevice).toBe(true);

    const remoteLarge = await executeWithEconomy({
      projectId: 'proj-batch', configuredProviders: ['openai', 'claude'],
      batchSize: 100, prompt: 'remote large', run, now: oct,
    });
    expect(remoteLarge.providerId).toBe('openai');
    expect(remoteLarge.leavesDevice).toBe(true);
  });

  it('denies external CMS transfer without explicit human approval and fact gate confirmation', async () => {
    const { cms, deps } = makeCmsDeps();
    cms.state.content = '<h2>Notice</h2><p>Dose is 100 mg.</p>';

    const plan = await planPatch({
      target: target('wordpress'), heading: 'Notice',
      replacement: '<p>Dose is 100 mg.</p>', ymyl: true,
    }, cms.send);

    await expect(applyPatch(plan, null, deps))
      .rejects.toMatchObject({ code: 'not-approved' });

    await expect(applyPatch(plan, { approvedBy: 'auditor', planHash: 'bad-hash' }, deps))
      .rejects.toMatchObject({ code: 'not-approved' });

    await expect(applyPatch(plan, { approvedBy: 'auditor', planHash: plan.planHash, factGatePassed: false }, deps))
      .rejects.toMatchObject({ code: 'fact-gate-required' });

    const ok = await applyPatch(plan, { approvedBy: 'auditor', planHash: plan.planHash, factGatePassed: true }, deps);
    expect(ok.status).toBe('verified');
  });
});
