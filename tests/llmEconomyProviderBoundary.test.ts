import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AIService } from '@/services/ai';
import { clearExactCache } from '@/services/llmEconomy/semanticCache';
import { leavesDevice } from '@/services/llmEconomy/costMeter';
import { readLlmSpend } from '@/services/llmEconomy/llmBudget';

const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }));

const projectId = 'provider-boundary';

const responseFor = (provider: 'openai' | 'claude' | 'gemini') => provider === 'openai'
  ? { choices: [{ message: { content: 'Hosted answer' } }] }
  : provider === 'claude'
    ? { content: [{ type: 'text', text: 'Hosted answer' }] }
    : { candidates: [{ content: { parts: [{ text: 'Hosted answer' }] } }] };

vi.mock('@/services/tauri', () => ({ invokeTauriCommand: invoke }));

beforeEach(() => {
  localStorage.clear();
  clearExactCache();
  invoke.mockReset();
});

describe('production provider economy boundary', () => {
  it.each(['openai', 'claude', 'gemini'] as const)('records hosted %s as cloud with unknown cost when usage is absent', async (provider) => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(responseFor(provider)), { status: 200 }));
    await AIService.generateText(provider, 'key', 'model', `hosted-${provider}`, 'api_key', { projectId });
    const spend = readLlmSpend(projectId);
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(spend.lastCall).toMatchObject({ providerId: provider, local: false, costUsd: null });
    expect(spend.unknownCostCalls).toBe(1);
    expect(leavesDevice(provider)).toBe(true);
    fetchMock.mockRestore();
  });

  it.each(['openai', 'claude', 'gemini'] as const)('keeps %s local_cli on the cloud/privacy-warning side of the ledger', async (provider) => {
    const fetchMock = vi.spyOn(globalThis, 'fetch');
    invoke.mockResolvedValue('CLI answer');
    await AIService.generateText(provider, '', 'ignored-model', `cli-${provider}`, 'local_cli', { projectId });
    const spend = readLlmSpend(projectId);
    expect(invoke).toHaveBeenCalledWith('run_ai_cli', { provider, prompt: `cli-${provider}` });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(spend.lastCall).toMatchObject({ providerId: provider, local: false, costUsd: null });
    expect(spend.unknownCostCalls).toBe(1);
    expect(leavesDevice(provider)).toBe(true);
    fetchMock.mockRestore();
  });
});
