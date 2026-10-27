import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AIService } from '@/services/ai';
import { useAuthStore } from '@/stores/authStore';
import { useProjectStore } from '@/stores/projectStore';
import { readLlmSpend, writeLlmBudget } from '@/services/llmEconomy/llmBudget';
import { clearExactCache } from '@/services/llmEconomy/semanticCache';
import { createAuditFixture } from './fixtures/audit';

const P = 'p_app_integration';

const mockResponse = (text: string) =>
  new Response(JSON.stringify({ choices: [{ message: { content: text } }] }), {
    status: 200, headers: { 'Content-Type': 'application/json' },
  });

beforeEach(() => {
  localStorage.clear();
  clearExactCache();
  useProjectStore.setState({ activeProjectId: P });
  useAuthStore.setState({
    provider: 'openai',
    model: 'gpt-4o',
    apiKeys: { openai: 'test-key', claude: '', gemini: '' },
    connectionStatus: { openai: 'connected', claude: 'unconfigured', gemini: 'unconfigured' },
    connectionMethod: { openai: 'api_key', claude: 'api_key', gemini: 'api_key' },
  });
});

describe('AIService and store integration with LLM economy', () => {
  it('routes AIService.generateText through project budget and exact cache', async () => {
    writeLlmBudget(P, { monthlyLimitUsd: 10, warnAtPercent: 80 });

    const fetchMock = vi.fn().mockImplementation(async () => mockResponse('Generated text'));
    vi.stubGlobal('fetch', fetchMock);

    // Call 1: Miss
    const res1 = await AIService.generateText('openai', 'test-key', 'gpt-4o', 'Summarize this page', 'api_key', {
      projectId: P, estimatedCostUsd: 0.05, actualCostUsd: 0.05,
    });
    expect(res1).toBe('Generated text');
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const spend1 = readLlmSpend(P);
    expect(spend1.spentUsd).toBe(0.05);
    expect(spend1.calls).toBe(1);
    expect(spend1.cacheHits).toBe(0);

    // Call 2: Exact repeat hit within project
    const res2 = await AIService.generateText('openai', 'test-key', 'gpt-4o', 'Summarize this page', 'api_key', {
      projectId: P, estimatedCostUsd: 0.05,
    });
    expect(res2).toBe('Generated text');
    expect(fetchMock).toHaveBeenCalledTimes(1); // No new network call

    const spend2 = readLlmSpend(P);
    expect(spend2.spentUsd).toBe(0.05);
    expect(spend2.savedUsd).toBe(0.05);
    expect(spend2.calls).toBe(2);
    expect(spend2.cacheHits).toBe(1);

    vi.unstubAllGlobals();
  });

  it('routes through cosine semantic cache when comparable vector is provided', async () => {
    writeLlmBudget(P, { monthlyLimitUsd: 10, warnAtPercent: 80 });

    const fetchMock = vi.fn().mockImplementation(async () => mockResponse('Semantic response'));
    vi.stubGlobal('fetch', fetchMock);

    // Store entry with vector [1, 0, 0]
    await AIService.generateText('openai', 'test-key', 'gpt-4o', 'What is SEO?', 'api_key', {
      projectId: P, estimatedCostUsd: 0.04, actualCostUsd: 0.04, vector: [1, 0, 0],
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Query with close vector [0.99, 0.01, 0] (cosine > 0.95 threshold) but slightly different wording
    const semHit = await AIService.generateText('openai', 'test-key', 'gpt-4o', 'Explain SEO concept', 'api_key', {
      projectId: P, estimatedCostUsd: 0.04, vector: [0.99, 0.01, 0],
    });
    expect(semHit).toBe('Semantic response');
    expect(fetchMock).toHaveBeenCalledTimes(1); // Served from cosine semantic cache

    const spend = readLlmSpend(P);
    expect(spend.cacheHits).toBe(1);
    expect(spend.savedUsd).toBe(0.04);

    vi.unstubAllGlobals();
  });

  it('blocks useAuthStore.generateText when project budget is exceeded', async () => {
    writeLlmBudget(P, { monthlyLimitUsd: 0.06, warnAtPercent: 80 });

    const fetchMock = vi.fn().mockImplementation(async () => mockResponse('Response'));
    vi.stubGlobal('fetch', fetchMock);

    // First call uses $0.05 of $0.06 budget
    await AIService.generateText('openai', 'test-key', 'gpt-4o', 'Initial prompt', 'api_key', {
      projectId: P, actualCostUsd: 0.05, estimatedCostUsd: 0.05,
    });

    // Second call without cost estimate under budget cap must be blocked
    await expect(useAuthStore.getState().generateText('Next unpriced prompt'))
      .rejects.toThrow();

    vi.unstubAllGlobals();
  });

  it('routes assistant suggestions through the project economy boundary', async () => {
    writeLlmBudget(P, { monthlyLimitUsd: null, warnAtPercent: 80 });
    const fetchMock = vi.fn().mockImplementation(async () => mockResponse(JSON.stringify({
      suggestedTitle: 'Observed title', suggestedDescription: 'Observed description',
      keyImprovements: ['Observed improvement'], schemaJsonLd: { '@type': 'WebPage' },
    })));
    vi.stubGlobal('fetch', fetchMock);
    const audit = createAuditFixture();
    await expect(useAuthStore.getState().generateSuggestions(audit, 'Keep evidence')).resolves.toMatchObject({ suggestedTitle: 'Observed title' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(readLlmSpend(P).calls).toBe(1);
    vi.unstubAllGlobals();
  });
});
