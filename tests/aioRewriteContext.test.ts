import { beforeEach, describe, expect, it, vi } from 'vitest';
import { rewritePassage } from '@/services/aioReadiness';
import { createBriefDeps, BriefRequestContextMismatchError } from '@/services/siteFocusBenchmark';
import { AIService } from '@/services/ai';
import { executeWithEconomy } from '@/services/llmEconomy';
import { createAuthGeneration } from '@/stores/auth/generation';
import { useAuthStore } from '@/stores/authStore';
import { useProjectStore } from '@/stores/projectStore';

const context = { projectId: 'p1', runId: 'r1', chunkId: 'https://site.test/p\u0000Facts\u00000', revision: 'rev-1' };
const chunk = { heading: 'Facts', text: 'A fact is 10 kg.', issues: ['no-facts' as const] };

describe('AIO rewrite request context', () => {
  const generateText = vi.fn<(prompt: string, requestContext?: typeof context) => Promise<string>>(async () => 'A fact is 10 kg.');

  beforeEach(() => {
    generateText.mockClear();
    useProjectStore.setState({ activeProjectId: 'p1' });
    useAuthStore.setState({ isProviderConnected: () => true, generateText } as never);
  });

  it('passes context beside the prompt without leaking IDs into prompt text', async () => {
    const deps = { isConfigured: () => true, generateText };
    await expect(rewritePassage(deps, chunk, { context })).resolves.toEqual({ status: 'ok', text: 'A fact is 10 kg.' });
    expect(generateText).toHaveBeenCalledWith(expect.not.stringContaining('p1'), context);
    expect(generateText.mock.calls[0]?.[0]).not.toContain('r1');
    expect(generateText.mock.calls[0]?.[0]).not.toContain('rev-1');
  });

  it('rejects a project switch before the provider is called', async () => {
    const deps = createBriefDeps();
    useProjectStore.setState({ activeProjectId: 'p2' });
    await expect(deps.generateText('rewrite', context)).rejects.toBeInstanceOf(BriefRequestContextMismatchError);
    expect(generateText).not.toHaveBeenCalled();
  });

  it('rejects incomplete scope before the provider is called', async () => {
    const deps = createBriefDeps();
    await expect(deps.generateText('rewrite', { ...context, revision: '' })).rejects.toBeInstanceOf(BriefRequestContextMismatchError);
    expect(generateText).not.toHaveBeenCalled();
  });

  it('carries the validated context into the AIService economy options', async () => {
    const aiSpy = vi.spyOn(AIService, 'generateText').mockResolvedValue('provider text');
    const state = useAuthStore.getState();
    useAuthStore.setState({
      ...createAuthGeneration(useAuthStore.setState, useAuthStore.getState),
      provider: 'openai',
      model: 'context-model',
      apiKeys: { ...state.apiKeys, openai: 'key' },
      connectionMethod: { ...state.connectionMethod, openai: 'api_key' },
    } as never);
    await expect(createBriefDeps().generateText('rewrite', context)).resolves.toBe('provider text');
    expect(aiSpy).toHaveBeenCalledWith('openai', 'key', 'context-model', 'rewrite', 'api_key', {
      projectId: 'p1',
      requestContext: context,
    });
    aiSpy.mockRestore();
  });

  it('rejects an economy envelope whose project differs from its context', async () => {
    const runner = vi.fn(async () => ({ text: 'must not run' }));
    await expect(executeWithEconomy({
      projectId: 'p2', configuredProviders: ['openai'], prompt: 'rewrite',
      requestContext: context, run: runner,
    })).rejects.toThrow('does not match the economy project scope');
    expect(runner).not.toHaveBeenCalled();
  });
});
