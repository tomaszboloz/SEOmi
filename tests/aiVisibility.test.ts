import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '@/stores/authStore';
import { useToolsStore } from '@/stores/toolsStore';
import i18n from '@/i18n';
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

it('compares the same prompt across connected local subscription CLIs, keeps per-provider evidence, and restores it by project', async () => {
    await useToolsStore.getState().runAiPromptComparison('What is SEOmi?');

    const comparison = useToolsStore.getState().aiPromptComparison;
    expect(comparison?.results.map((result) => result.provider)).toEqual(['openai', 'claude', 'gemini']);
    expect(comparison?.results.every((result) => result.response_status === 'success' && result.captured_at && result.connection_method === 'local_cli')).toBe(true);
    expect(comparison?.results[0].citations).toEqual(['https://openai.example/source']);
    const storedHistory = JSON.parse(localStorage.getItem('seomi_project_ai-project-one_ai_prompt_comparison_v1') || '[]');
    expect(storedHistory).toHaveLength(1);
    expect(storedHistory[0].prompt).toBe('What is SEOmi?');

    localStorage.setItem('seomi_active_project_v1', 'ai-project-two');
    await useToolsStore.getState().hydrateProject('ai-project-two');
    expect(useToolsStore.getState().aiPromptComparison).toBeNull();
    expect(useToolsStore.getState().aiPromptHistory).toEqual([]);
    localStorage.setItem('seomi_active_project_v1', 'ai-project-one');
    await useToolsStore.getState().hydrateProject('ai-project-one');
    expect(useToolsStore.getState().aiPromptComparison?.prompt).toBe('What is SEOmi?');
  });

it('does not call API-key providers, preserves individual failures, and records brand mention rate only over successful CLI answers', async () => {
    useAuthStore.setState({
      connectionMethod: { openai: 'local_cli', claude: 'api_key', gemini: 'local_cli' },
      generateTextForProvider: vi.fn(async (provider) => {
        if (provider === 'gemini') throw new Error('CLI quota reached');
        return 'SEOmi is mentioned. https://seomi.example/page';
      }),
    });

    await useToolsStore.getState().analyzeAiBrandVisibility('SEOmi', 'seomi.example');

    const report = useToolsStore.getState().aiBrandReport;
    expect(report?.models.map((model) => model.provider)).toEqual(['openai', 'gemini']);
    expect(report?.models.map((model) => model.response_status)).toEqual(['success', 'error']);
    expect(report?.models[1].error_message).toBe('CLI quota reached');
    expect(report?.overall_score).toBe(100);
    expect(useAuthStore.getState().generateTextForProvider).toHaveBeenCalledTimes(2);
    expect(JSON.parse(localStorage.getItem('seomi_project_ai-project-one_ai_brand_report_v1') || '[]')[0].brand).toBe('SEOmi');
  });

it('requires a project and at least one connected local subscription client', async () => {
    localStorage.removeItem('seomi_active_project_v1');
    await useToolsStore.getState().runAiPromptComparison('test prompt');
    expect(useToolsStore.getState().aiPromptError).toContain(i18n.t('runtimeErrors.tools.projectRequired'));

    localStorage.setItem('seomi_active_project_v1', 'ai-project-one');
    const failingTest = vi.fn(async (provider: 'openai' | 'claude' | 'gemini') => {
      useAuthStore.setState((state) => ({ connectionStatus: { ...state.connectionStatus, [provider]: 'error' } }));
      return { success: false, message: 'missing' };
    });
    useAuthStore.setState({ connectionStatus: { openai: 'unconfigured', claude: 'unconfigured', gemini: 'unconfigured' }, testProviderConnection: failingTest });
    await useToolsStore.getState().runAiPromptComparison('test prompt');
    expect(failingTest).toHaveBeenCalledTimes(3);
    expect(useToolsStore.getState().aiPromptError).toContain(i18n.t('runtimeErrors.tools.aiConnect'));
    expect(useToolsStore.getState().aiPromptComparison).toBeNull();
  });

it('checks untested local CLIs automatically after an app restart instead of asking the user to test again', async () => {
    const passingTest = vi.fn(async (provider: 'openai' | 'claude' | 'gemini') => {
      useAuthStore.setState((state) => ({ connectionStatus: { ...state.connectionStatus, [provider]: 'connected' } }));
      return { success: true, message: 'ok' };
    });
    useAuthStore.setState({
      connectionMethod: { openai: 'api_key', claude: 'local_cli', gemini: 'api_key' },
      connectionStatus: { openai: 'unconfigured', claude: 'unconfigured', gemini: 'unconfigured' },
      testProviderConnection: passingTest,
    });

    await useToolsStore.getState().analyzeAiBrandVisibility('SEOmi', 'seomi.app');

    expect(passingTest).toHaveBeenCalledTimes(1);
    expect(passingTest).toHaveBeenCalledWith('claude');
    expect(useToolsStore.getState().aiBrandError).toBeNull();
    expect(useToolsStore.getState().aiBrandReport?.models.map((model) => model.provider)).toEqual(['claude']);
  });

it.each(['brand', 'prompt'])('does not start %s research after switching projects during authentication', async (workflow) => {
    let finishAuthentication!: () => void;
    const passingTest = vi.fn(() => new Promise<{ success: boolean; message: string }>((resolve) => {
      finishAuthentication = () => {
        useAuthStore.setState({ connectionStatus: { openai: 'connected', claude: 'unconfigured', gemini: 'unconfigured' } });
        resolve({ success: true, message: 'ok' });
      };
    }));
    useAuthStore.setState({
      connectionMethod: { openai: 'local_cli', claude: 'api_key', gemini: 'api_key' },
      connectionStatus: { openai: 'unconfigured', claude: 'unconfigured', gemini: 'unconfigured' },
      testProviderConnection: passingTest,
    });
    const run = workflow === 'brand'
      ? useToolsStore.getState().analyzeAiBrandVisibility('SEOmi', 'seomi.test')
      : useToolsStore.getState().runAiPromptComparison('Which tool offers audits?');
    await vi.waitFor(() => expect(passingTest).toHaveBeenCalledTimes(1));
    localStorage.setItem('seomi_active_project_v1', 'ai-project-two');
    finishAuthentication();
    await run;
    expect(useAuthStore.getState().generateTextForProvider).not.toHaveBeenCalled();
  });

it('keeps all-provider failures as unknown scores and redacts error text before persistence', async () => {
    useAuthStore.setState({ generateTextForProvider: vi.fn(async () => { throw new Error('Failed for user@example.test at /Users/test/private'); }) });
    await useToolsStore.getState().analyzeAiBrandVisibility('SEOmi', 'seomi.test');
    const report = useToolsStore.getState().aiBrandReport!;
    expect(report.overall_score).toBeNull();
    expect(report.share_of_voice).toBeNull();
    expect(report.models.every((model) => model.response_status === 'error')).toBe(true);
    const stored = localStorage.getItem('seomi_project_ai-project-one_ai_brand_report_v1');
    expect(stored).toContain('redacted');
    expect(stored).not.toContain('user@example.test');
    expect(stored).not.toContain('/Users/test/private');
    await useToolsStore.getState().runAiPromptComparison('Which audit tool?');
    const promptStored = localStorage.getItem('seomi_project_ai-project-one_ai_prompt_comparison_v1');
    expect(promptStored).toContain('redacted');
    expect(promptStored).not.toContain('user@example.test');
    expect(promptStored).not.toContain('/Users/test/private');
  });
});
