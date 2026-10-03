import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createAiSlice } from '@/stores/tools/aiSlice';
import { createAiBrandActions } from '@/stores/tools/ai/brand';
import { createAiPromptsActions } from '@/stores/tools/ai/prompts';
import { useProjectStore } from '@/stores/projectStore';
import { useAuthStore } from '@/stores/authStore';
import { isolatedToolsSlice } from './fixtures/toolsSlice';
import { connected } from './fixtures/aiVisibilityContracts';
const original = useAuthStore.getState();
beforeEach(() => {
  localStorage.clear();
  useProjectStore.setState({ activeProjectId: 'ai-direct' });
  useAuthStore.setState({ ...connected, connectionMethod: { openai: 'local_cli', claude: 'api_key', gemini: 'api_key' } });
});
afterEach(() => { vi.restoreAllMocks(); useAuthStore.setState(original); });

it('exposes all AI settings and selection actions through the direct facade', async () => {
  const generateText = vi.fn().mockResolvedValue('SEOmi offers audits. https://seomi.test/audit');
  const { store, actions } = isolatedToolsSlice((set, get, services) => createAiSlice(set, get, services), { generateText });
  actions.setAiResearchSettings({ prompts: ['Which audit tool?'], repetitions: 1, competitors: [] });
  actions.setAiBrandQuery('SEOmi');
  actions.setAiBrandDomain('seomi.test');
  actions.setAiSearchPrompt('Which audit tool?');
  await actions.analyzeAiBrandVisibility();
  const report = store.getState().aiBrandReport!;
  expect(report).toMatchObject({ brand: 'SEOmi', domain: 'seomi.test', overall_score: 100 });
  actions.selectAiBrandReport('missing');
  actions.selectAiBrandReport(report.timestamp);
  expect(store.getState().aiBrandReport).toEqual(report);
  await actions.runAiPromptComparison();
  const comparison = store.getState().aiPromptComparison!;
  expect(comparison.results[0]).toMatchObject({ provider: 'openai', response_status: 'success', own_domain_cited: true });
  actions.selectAiPromptComparison('missing');
  actions.selectAiPromptComparison(comparison.captured_at);
  expect(store.getState().aiPromptComparison).toEqual(comparison);
  expect(generateText).toHaveBeenCalledTimes(2);
});

it('directly retains failed brand observations without inventing a visibility score', async () => {
  const { store, actions } = isolatedToolsSlice((set, get, services) => createAiBrandActions(set, get, services),
    { generateText: vi.fn().mockRejectedValue(new Error('fixture failure')) });
  actions.setAiResearchSettings({ prompts: ['Which audit tool?'], repetitions: 1 });
  await actions.analyzeAiBrandVisibility('SEOmi', 'seomi.test');
  expect(store.getState().aiBrandReport).toMatchObject({ overall_score: null, share_of_voice: null,
    models: [{ response_status: 'error', summary: '', error_message: 'fixture failure' }] });
  expect(store.getState().isAiBrandLoading).toBe(false);
});

it('directly retains failed prompt evidence and redacts local context in errors', async () => {
  const { store, actions } = isolatedToolsSlice((set, get, services) => createAiPromptsActions(set, get, services),
    { generateText: vi.fn().mockRejectedValue('failure /Users/private/project') });
  actions.setAiSearchPrompt('Which audit tool?');
  await actions.runAiPromptComparison();
  expect(store.getState().aiPromptComparison?.results[0]).toMatchObject({ response_status: 'error', response_text: '' });
  expect(store.getState().aiPromptComparison?.results[0].error_message).not.toContain('/Users/private');
  expect(store.getState().isAiPromptLoading).toBe(false);
});

it('keeps an observed absence at zero while leaving unobserved share of voice unknown', async () => {
  const { store, actions } = isolatedToolsSlice((set, get, services) => createAiBrandActions(set, get, services),
    { generateText: vi.fn().mockResolvedValue('No relevant recommendations.') });
  actions.setAiResearchSettings({ prompts: ['Which audit tool?'], repetitions: 1 });
  await actions.analyzeAiBrandVisibility('SEOmi');
  expect(store.getState().aiBrandReport).toMatchObject({ overall_score: 0, share_of_voice: null,
    models: [{ response_status: 'success', is_present: false, visibility_percentage: 0 }] });
});

it('does not call an AI provider without a project or a nonempty request', async () => {
  useProjectStore.setState({ activeProjectId: null });
  const generateText = vi.fn();
  const { store, actions } = isolatedToolsSlice((set, get, services) => createAiSlice(set, get, services), { generateText });
  await actions.analyzeAiBrandVisibility('');
  await actions.runAiPromptComparison('');
  await actions.analyzeAiBrandVisibility('SEOmi');
  await actions.runAiPromptComparison('Which tool?');
  expect(generateText).not.toHaveBeenCalled();
  expect(store.getState().aiBrandError).toBeTruthy();
  expect(store.getState().aiPromptError).toBeTruthy();
});

it('contains disconnected-provider errors in both direct workflows', async () => {
  useAuthStore.setState({ connectionMethod: { openai: 'api_key', claude: 'api_key', gemini: 'api_key' } });
  const generateText = vi.fn();
  const { store, actions } = isolatedToolsSlice((set, get, services) => createAiSlice(set, get, services), { generateText });
  await actions.analyzeAiBrandVisibility('SEOmi');
  await actions.runAiPromptComparison('Which tool?');
  expect(generateText).not.toHaveBeenCalled();
  expect(store.getState()).toMatchObject({ isAiBrandLoading: false, isAiPromptLoading: false });
  expect(store.getState().aiBrandError).toBeTruthy();
  expect(store.getState().aiPromptError).toBeTruthy();
});
