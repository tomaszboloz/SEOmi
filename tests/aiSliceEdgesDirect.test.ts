import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createAiSlice } from '@/stores/tools/aiSlice';
import { useProjectStore } from '@/stores/projectStore';
import { useAuthStore } from '@/stores/authStore';
import { isolatedToolsSlice } from './fixtures/toolsSlice';
import { connected } from './fixtures/aiVisibilityContracts';
const original = useAuthStore.getState();
const methods = ['analyzeAiBrandVisibility', 'runAiPromptComparison'] as const;
beforeEach(() => {
  localStorage.clear();
  useProjectStore.setState({ activeProjectId: 'ai-edges' });
  useAuthStore.setState({ ...connected, connectionMethod: { openai: 'local_cli', claude: 'api_key', gemini: 'api_key' } });
});
afterEach(() => { vi.restoreAllMocks(); useAuthStore.setState(original); });
const setup = (generateText = vi.fn().mockResolvedValue('SEOmi offers audits.')) => {
  const slice = isolatedToolsSlice((set, get, services) => createAiSlice(set, get, services), { generateText });
  slice.actions.setAiBrandQuery('SEOmi');
  slice.actions.setAiResearchSettings({ prompts: ['Which audit tool?'], repetitions: 1 });
  slice.actions.setAiSearchPrompt('Which audit tool?');
  return { ...slice, generateText };
};

it('keeps all setters usable without a project and writes no shared storage', () => {
  useProjectStore.setState({ activeProjectId: null });
  const { actions, store } = setup();
  actions.setAiBrandDomain('seomi.test');
  expect(store.getState()).toMatchObject({ aiBrandQuery: 'SEOmi', aiBrandDomain: 'seomi.test', aiSearchPrompt: 'Which audit tool?' });
  expect(localStorage.length).toBe(0);
});

it.each(methods)('rejects $0 after project change during provider connection', async method => {
  const { actions, store, generateText } = setup();
  useAuthStore.setState({ connectionStatus: { ...connected.connectionStatus, openai: 'unconfigured' },
    testProviderConnection: vi.fn(async () => { useProjectStore.setState({ activeProjectId: 'other' }); return { success: false, message: 'fixture' }; }) });
  await actions[method]();
  expect(generateText).not.toHaveBeenCalled();
  expect(store.getState().aiBrandReport).toBeNull();
  expect(store.getState().aiPromptComparison).toBeNull();
});

it.each(methods.flatMap(method => [false, true].map(stale => ({ method, stale }))))(
  'contains unstructured provider-connection failure in $method (stale=$stale)', async ({ method, stale }) => {
    const { actions, store, generateText } = setup();
    useAuthStore.setState({ connectionStatus: { ...connected.connectionStatus, openai: 'unconfigured' },
      testProviderConnection: vi.fn(async () => {
        if (stale) useProjectStore.setState({ activeProjectId: 'other' });
        throw 'unstructured connection failure';
      }) });
    await actions[method]();
    expect(generateText).not.toHaveBeenCalled();
    const error = method === 'analyzeAiBrandVisibility' ? store.getState().aiBrandError : store.getState().aiPromptError;
    if (stale) expect(error).toBeNull(); else expect(error).toBeTruthy();
  },
);

it('retains bounded brand history while deduplicating the selected timestamp', async () => {
  const { actions, store } = setup();
  await actions.analyzeAiBrandVisibility();
  const first = store.getState().aiBrandReport!;
  store.setState({ aiBrandHistory: [first, { ...first, timestamp: '2020-01-01T00:00:00Z' }] });
  await actions.analyzeAiBrandVisibility();
  expect(store.getState().aiBrandHistory.some(row => row.timestamp === '2020-01-01T00:00:00Z')).toBe(true);
  expect(new Set(store.getState().aiBrandHistory.map(row => row.timestamp)).size).toBe(store.getState().aiBrandHistory.length);
});

it('rejects the final brand report when a single response completes after switching projects', async () => {
  const generateText = vi.fn(async () => {
    useProjectStore.setState({ activeProjectId: 'other' });
    return 'SEOmi offers audits.';
  });
  const { actions, store } = setup(generateText);
  await actions.analyzeAiBrandVisibility();
  expect(generateText).toHaveBeenCalledTimes(1);
  expect(store.getState().aiBrandReport).toBeNull();
  expect(localStorage.getItem('seomi_project_other_ai_brand_report_v1')).toBeNull();
});
