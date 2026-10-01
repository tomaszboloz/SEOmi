import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '@/stores/authStore';
import { useToolsStore } from '@/stores/toolsStore';

import { connected } from "./fixtures/aiVisibilityContracts";

describe('project-scoped AI answer research', () => {
beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('seomi_active_project_v1', 'ai-project-one');
    useToolsStore.setState({ aiResearchSettings: { prompts: ['Who offers SEO audits?'], repetitions: 1, competitors: [] }, aiBrandQuery: 'SEOmi', aiBrandDomain: '', aiBrandReport: null, aiBrandHistory: [], aiPromptComparison: null, aiPromptHistory: [], aiBrandError: null, aiPromptError: null });
    useAuthStore.setState({
      ...connected,
      apiKeys: { openai: '', claude: '', gemini: '' },
      generateTextForProvider: vi.fn(async (provider) => `${provider} answer mentions SEOmi. https://${provider}.example/source`),
    });
  });

it('does not let a delayed comparison from another project clear a newer run', async () => {
    useAuthStore.setState({
      connectionMethod: { openai: 'local_cli', claude: 'api_key', gemini: 'api_key' },
      connectionStatus: { openai: 'connected', claude: 'unconfigured', gemini: 'unconfigured' },
    });
    const pending: Array<{ resolve: (value: string) => void }> = [];
    useAuthStore.setState({
      generateTextForProvider: vi.fn(() => new Promise<string>((resolve) => { pending.push({ resolve }); })),
    });

    const oldRun = useToolsStore.getState().runAiPromptComparison('old project prompt');
    await vi.waitFor(() => expect(pending).toHaveLength(1));
    localStorage.setItem('seomi_active_project_v1', 'ai-project-two');
    const newRun = useToolsStore.getState().runAiPromptComparison('new project prompt');
    await vi.waitFor(() => expect(pending).toHaveLength(2));

    pending[0]?.resolve('old response');
    await Promise.resolve();
    expect(useToolsStore.getState().isAiPromptLoading).toBe(true);

    pending[1]?.resolve('new response');
    await Promise.all([oldRun, newRun]);
    expect(useToolsStore.getState().isAiPromptLoading).toBe(false);
  });

it('keeps the newest same-project prompt comparison when responses finish out of order', async () => {
    useAuthStore.setState({
      connectionMethod: { openai: 'local_cli', claude: 'api_key', gemini: 'api_key' },
      connectionStatus: { openai: 'connected', claude: 'unconfigured', gemini: 'unconfigured' },
    });
    const pending: Array<{ resolve: (value: string) => void }> = [];
    useAuthStore.setState({
      generateTextForProvider: vi.fn(() => new Promise<string>((resolve) => { pending.push({ resolve }); })),
    });

    const oldRun = useToolsStore.getState().runAiPromptComparison('older prompt');
    await vi.waitFor(() => expect(pending).toHaveLength(1));
    const newRun = useToolsStore.getState().runAiPromptComparison('newer prompt');
    await vi.waitFor(() => expect(pending).toHaveLength(2));

    pending[0]?.resolve('older response');
    await Promise.resolve();
    expect(useToolsStore.getState().isAiPromptLoading).toBe(true);
    expect(useToolsStore.getState().aiPromptComparison).toBeNull();

    pending[1]?.resolve('newer response');
    await Promise.all([oldRun, newRun]);
    expect(useToolsStore.getState().isAiPromptLoading).toBe(false);
    expect(useToolsStore.getState().aiPromptComparison?.prompt).toBe('newer prompt');
  });
});
