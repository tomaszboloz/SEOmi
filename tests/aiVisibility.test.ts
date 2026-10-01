import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '@/stores/authStore';
import { useToolsStore } from '@/stores/toolsStore';
import i18n from '@/i18n';

const connected = {
  connectionMethod: { openai: 'local_cli', claude: 'local_cli', gemini: 'local_cli' } as const,
  connectionStatus: { openai: 'connected', claude: 'connected', gemini: 'connected' } as const,
};

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

  it('stops subsequent questions and repetitions after leaving the project mid-response', async () => {
    useToolsStore.getState().setAiResearchSettings({ prompts: ['Which audit tool?', 'Who offers audits?'], repetitions: 3 });
    let complete!: (value: string) => void;
    useAuthStore.setState({
      connectionMethod: { openai: 'local_cli', claude: 'api_key', gemini: 'api_key' },
      generateTextForProvider: vi.fn(() => new Promise<string>((resolve) => { complete = resolve; })),
    });
    const run = useToolsStore.getState().analyzeAiBrandVisibility('SEOmi', 'seomi.test');
    await vi.waitFor(() => expect(useAuthStore.getState().generateTextForProvider).toHaveBeenCalledTimes(1));
    localStorage.setItem('seomi_active_project_v1', 'ai-project-two');
    complete('SEOmi: https://seomi.test');
    await run;
    expect(useAuthStore.getState().generateTextForProvider).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem('seomi_project_ai-project-two_ai_brand_report_v1')).toBeNull();
    expect(localStorage.getItem('seomi_project_ai-project-one_ai_brand_report_v1')).toBeNull();
  });

  it('requires explicit research questions instead of supplying a branded default prompt', async () => {
    useToolsStore.getState().setAiResearchSettings({ prompts: [] });
    await useToolsStore.getState().analyzeAiBrandVisibility('SEOmi', 'seomi.test');
    expect(useToolsStore.getState().aiBrandError).toBe(i18n.t('aiResearch.promptsRequired'));
    expect(useAuthStore.getState().generateTextForProvider).not.toHaveBeenCalled();
  });

  it('appends prompt runs, restores the project history and lets the user select an older run', async () => {
    await useToolsStore.getState().runAiPromptComparison('first prompt');
    const first = useToolsStore.getState().aiPromptComparison!;
    await new Promise((resolve) => setTimeout(resolve, 2));
    await useToolsStore.getState().runAiPromptComparison('second prompt');

    expect(useToolsStore.getState().aiPromptHistory.map((item) => item.prompt)).toEqual(['second prompt', 'first prompt']);
    localStorage.setItem('seomi_active_project_v1', 'ai-project-two');
    await useToolsStore.getState().hydrateProject('ai-project-two');
    expect(useToolsStore.getState().aiPromptHistory).toEqual([]);
    localStorage.setItem('seomi_active_project_v1', 'ai-project-one');
    await useToolsStore.getState().hydrateProject('ai-project-one');
    expect(useToolsStore.getState().aiPromptHistory).toHaveLength(2);
    useToolsStore.getState().selectAiPromptComparison(first.captured_at);
    expect(useToolsStore.getState().aiPromptComparison?.prompt).toBe('first prompt');
    expect(localStorage.getItem('seomi_project_ai-project-one_ai_prompt_selection_v1')).toBe(JSON.stringify(first.captured_at));
    await useToolsStore.getState().hydrateProject('ai-project-one');
    expect(useToolsStore.getState().aiPromptComparison?.prompt).toBe('first prompt');
  });

  it('measures repeated unbranded questions and records competitor position, own citations and search mode', async () => {
    useToolsStore.getState().setAiResearchSettings({ prompts: ['Who offers SEO audits?', 'Which desktop audit tool should I use?'], repetitions: 2, competitors: ['OtherBrand'] });
    useAuthStore.setState({
      connectionMethod: { openai: 'local_cli', claude: 'api_key', gemini: 'api_key' },
      generateTextForProvider: vi.fn(async () => 'OtherBrand and SEOmi provide audits. https://seomi.test/audit'),
    });
    await useToolsStore.getState().analyzeAiBrandVisibility('SEOmi', 'seomi.test');
    const report = useToolsStore.getState().aiBrandReport!;
    expect(report.methodology).toBe('unbranded_prompts');
    expect(report.models).toHaveLength(4);
    expect(report.overall_score).toBe(100);
    expect(report.share_of_voice).toBe(50);
    expect(report.models[0]).toMatchObject({ mention_position: 2, own_domain_cited: true, search_mode: 'model_knowledge', competitors_mentioned: ['OtherBrand'], repetition: 1 });
    for (const [, prompt] of vi.mocked(useAuthStore.getState().generateTextForProvider).mock.calls) {
      expect(prompt).not.toContain('SEOmi');
      expect(prompt).not.toContain('seomi.test');
    }
    await useToolsStore.getState().hydrateProject('ai-project-two');
    expect(useToolsStore.getState().aiResearchSettings.prompts).toEqual([]);
    await useToolsStore.getState().hydrateProject('ai-project-one');
    expect(useToolsStore.getState().aiResearchSettings.repetitions).toBe(2);
  });

  it('does not execute branded visibility questions and redacts personal context in Prompt Explorer too', async () => {
    useToolsStore.getState().setAiResearchSettings({ prompts: ['What is SEOmi?'] });
    await useToolsStore.getState().analyzeAiBrandVisibility('SEOmi', 'seomi.test');
    expect(useToolsStore.getState().aiBrandError).toBe(i18n.t('aiResearch.unbrandedRequired'));
    expect(useAuthStore.getState().generateTextForProvider).not.toHaveBeenCalled();
    useAuthStore.setState({ generateTextForProvider: vi.fn(async () => 'SEOmi: https://seomi.test/a. Private: user@example.test /Users/test/project') });
    useToolsStore.setState({ aiBrandQuery: 'SEOmi', aiBrandDomain: 'seomi.test' });
    await useToolsStore.getState().runAiPromptComparison('Which audit tool?');
    const result = useToolsStore.getState().aiPromptComparison!.results[0];
    expect(result.brand_mentions).toEqual(['SEOmi']);
    expect(result.own_domain_cited).toBe(true);
    expect(result.response_text).not.toContain('user@example.test');
    expect(result.response_text).not.toContain('/Users/test');
    expect(localStorage.getItem('seomi_project_ai-project-one_ai_prompt_comparison_v1')).not.toContain('user@example.test');
  });

  it('migrates legacy single-result records into in-memory histories and uses the latest as active', async () => {
    const legacyBrand = { brand: 'Legacy brand', domain: 'legacy.test', timestamp: '2026-01-01T00:00:00.000Z', overall_score: null, query_checked: '', key_takeaways: [], models: [] };
    const legacyPrompt = { prompt: 'legacy prompt', captured_at: '2026-01-02T00:00:00.000Z', results: [] };
    localStorage.setItem('seomi_project_ai-project-one_ai_brand_report_v1', JSON.stringify(legacyBrand));
    localStorage.setItem('seomi_project_ai-project-one_ai_prompt_comparison_v1', JSON.stringify(legacyPrompt));

    await useToolsStore.getState().hydrateProject('ai-project-one');

    expect(useToolsStore.getState().aiBrandHistory).toEqual([legacyBrand]);
    expect(useToolsStore.getState().aiBrandReport).toEqual(legacyBrand);
    expect(useToolsStore.getState().aiPromptHistory).toEqual([legacyPrompt]);
    expect(useToolsStore.getState().aiPromptComparison).toEqual(legacyPrompt);
  });

  it('keeps at most 50 saved comparisons, with the newest first', async () => {
    const previous = Array.from({ length: 50 }, (_, index) => ({ prompt: `saved ${index}`, captured_at: `2026-01-${String(index + 1).padStart(2, '0')}T00:00:00.000Z`, results: [] }));
    useToolsStore.setState({ aiPromptHistory: previous });

    await useToolsStore.getState().runAiPromptComparison('newest');

    expect(useToolsStore.getState().aiPromptHistory).toHaveLength(50);
    expect(useToolsStore.getState().aiPromptHistory[0].prompt).toBe('newest');
    expect(useToolsStore.getState().aiPromptHistory.some((item) => item.prompt === 'saved 49')).toBe(false);
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
