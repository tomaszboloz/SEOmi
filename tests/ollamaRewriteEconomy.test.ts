import { beforeEach, describe, expect, it, vi } from 'vitest';
import { withOllamaFallback } from '@/services/aioReadiness/rewriteDeps';
import { clearExactCache, readLlmSpend } from '@/services/llmEconomy';

const chat = vi.hoisted(() => vi.fn());
vi.mock('@/services/embeddings/ollamaChat', () => ({ createOllamaChat: () => chat }));

const none = { isConfigured: () => false, generateText: vi.fn() };

beforeEach(() => { localStorage.clear(); clearExactCache(); chat.mockReset(); });

describe('local Ollama rewrite goes through the LLM economy (#137)', () => {
  it('answers a repeated prompt from the project cache and books it as local, cost 0', async () => {
    localStorage.setItem('seomi_project_p1_ollama_assistant_model_v1', 'llama3');
    chat.mockResolvedValue({ text: 'Rewritten.' });
    const deps = withOllamaFallback(none, 'p1');
    expect(await deps.generateText('same prompt')).toBe('Rewritten.');
    expect(await deps.generateText('same prompt')).toBe('Rewritten.');
    expect(chat).toHaveBeenCalledTimes(1);
    const spend = readLlmSpend('p1');
    expect(spend.lastCall).toMatchObject({ providerId: 'ollama', model: 'llama3', costUsd: 0, cached: true, local: true });
  });

  it('keeps projects apart: another project does not reuse the cached answer', async () => {
    localStorage.setItem('seomi_project_p1_ollama_assistant_model_v1', 'llama3');
    localStorage.setItem('seomi_project_p2_ollama_assistant_model_v1', 'llama3');
    chat.mockResolvedValue({ text: 'One.' });
    await withOllamaFallback(none, 'p1').generateText('prompt');
    await withOllamaFallback(none, 'p2').generateText('prompt');
    expect(chat).toHaveBeenCalledTimes(2);
  });
});
