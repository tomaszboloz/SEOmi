import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import i18n from '@/i18n';
import { testAiConnection } from '@/services/ai/connection';
import { listProviderModels } from '@/services/ai/modelList';
import { callClaude, callGemini, callOpenAI } from '@/services/ai/suggestions';
import { generateAiText } from '@/services/ai/text';

const invoke = vi.hoisted(() => vi.fn());
const nativeText = vi.hoisted(() => vi.fn());
const nativeSuggestions = vi.hoisted(() => vi.fn());

vi.mock('@/services/tauri', () => ({ invokeTauriCommand: invoke }));
vi.mock('@/services/ai/native', () => ({
  isDesktopAi: () => typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window,
  nativeText,
  nativeSuggestions,
}));

const desktop = () => Object.defineProperty(window, '__TAURI_INTERNALS__', { configurable: true, value: {} });
const connected = (provider: string) => ({ success: true, message: i18n.t('runtimeErrors.ai.connected', { provider }) });
const failed = (key: string, values: Record<string, unknown>) => i18n.t(`runtimeErrors.ai.${key}`, values);
const suggestion = { suggestedTitle: 'Title', suggestedDescription: 'Description', keyImprovements: ['Evidence'] };

beforeEach(async () => {
  await i18n.changeLanguage('en');
  invoke.mockReset();
  nativeText.mockReset().mockResolvedValue('desktop text');
  nativeSuggestions.mockReset().mockResolvedValue(JSON.stringify(suggestion));
  desktop();
});
afterEach(() => {
  delete (window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__;
  vi.restoreAllMocks();
});

it('covers empty-key desktop connection outcomes and safe native failures', async () => {
  invoke.mockResolvedValueOnce({ success: true, status: 200 });
  await expect(testAiConnection('openai', '')).resolves.toEqual(connected(i18n.t('legacyUi.ai.openai')));
  invoke.mockResolvedValueOnce({ success: false, status: null });
  await expect(testAiConnection('openai', '')).resolves.toEqual({ success: false, message: failed('keyRequired', {}) });
  invoke.mockRejectedValueOnce(new Error('keychain details stay native'));
  await expect(testAiConnection('openai', '')).resolves.toEqual({ success: false, message: failed('keyRequired', {}) });
});

it('maps every desktop provider status branch to a localized result', async () => {
  invoke.mockResolvedValueOnce({ success: true, status: 200 });
  await expect(testAiConnection('claude', 'key')).resolves.toEqual(connected(i18n.t('legacyUi.ai.claude')));
  invoke.mockResolvedValueOnce({ success: false, status: 401 });
  await expect(testAiConnection('openai', 'key')).resolves.toEqual({ success: false, message: failed('invalidKey', { provider: i18n.t('legacyUi.ai.openai') }) });
  invoke.mockResolvedValueOnce({ success: false, status: 400 });
  await expect(testAiConnection('openai', 'key')).resolves.toEqual({ success: false, message: failed('responded', { provider: i18n.t('legacyUi.ai.openai'), status: 400 }) });
  invoke.mockResolvedValueOnce({ success: false, status: 429 });
  await expect(testAiConnection('claude', 'key')).resolves.toEqual({ success: false, message: failed('quotaExceeded', { provider: i18n.t('legacyUi.ai.claude') }) });
  invoke.mockResolvedValueOnce({ success: false, status: null });
  await expect(testAiConnection('openai', 'key')).resolves.toEqual({ success: false, message: failed('responded', { provider: i18n.t('legacyUi.ai.openai'), status: 0 }) });
  for (const status of [400, 403]) {
    invoke.mockResolvedValueOnce({ success: false, status });
    await expect(testAiConnection('gemini', 'key')).resolves.toEqual({ success: false, message: failed('invalidKey', { provider: i18n.t('legacyUi.ai.gemini') }) });
  }
});

it('uses the native model list and removes hidden models', async () => {
  invoke.mockResolvedValue([{ id: 'o3-mini', label: 'hidden' }, { id: 'gpt-4o', label: 'visible' }]);
  await expect(listProviderModels('openai', 'ignored')).resolves.toEqual([{ id: 'gpt-4o', label: 'visible' }]);
  expect(invoke).toHaveBeenCalledWith('ai_list_models', { provider: 'openai' });
});

it('routes all suggestion and text providers through the native transport', async () => {
  await expect(callOpenAI('key', 'model', 'prompt')).resolves.toEqual(suggestion);
  await expect(callClaude('key', 'model', 'prompt')).resolves.toEqual(suggestion);
  await expect(callGemini('key', 'model', 'prompt')).resolves.toEqual(suggestion);
  await expect(generateAiText('gemini', 'key', 'model', 'prompt')).resolves.toBe('desktop text');
  expect(nativeSuggestions).toHaveBeenCalledTimes(3);
  expect(nativeText).toHaveBeenCalledWith('gemini', 'model', 'prompt');
});
