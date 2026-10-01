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
});
