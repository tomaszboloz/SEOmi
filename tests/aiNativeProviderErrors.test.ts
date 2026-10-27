import { beforeEach, expect, it, vi } from 'vitest';
import i18n from '@/i18n';
import { nativeSuggestions, nativeText } from '@/services/ai/native';
import { aiResponseError } from '@/services/ai/response';

const invoke = vi.hoisted(() => vi.fn());
vi.mock('@/services/tauri', () => ({ invokeTauriCommand: invoke }));

const message = (key: string, values: Record<string, unknown>) => i18n.t(`runtimeErrors.ai.${key}`, values);
const openai = i18n.t('legacyUi.ai.openai');

beforeEach(async () => { await i18n.changeLanguage('en'); invoke.mockReset(); });

it.each([400, 404])('names the model when the provider answers %i to a native request', async (status) => {
  invoke.mockRejectedValue(`AI provider request failed with HTTP ${status}.`);
  const expected = message('modelRejected', { provider: openai, model: 'gpt-6.1-sol', status });
  await expect(nativeSuggestions('openai', 'gpt-6.1-sol', 'p')).rejects.toThrow(expected);
  await expect(nativeText('openai', 'gpt-6.1-sol', 'p')).rejects.toThrow(expected);
  expect(invoke).toHaveBeenCalledWith('ai_generate_suggestions', { provider: 'openai', model: 'gpt-6.1-sol', prompt: 'p' });
});

it('keeps the key and quota messages for suggestions and the status for other failures', async () => {
  invoke.mockRejectedValueOnce(new Error('AI provider request failed with HTTP 401.'));
  await expect(nativeSuggestions('openai', 'm', 'p')).rejects.toThrow(message('authFailed', { provider: openai }));
  invoke.mockRejectedValueOnce('AI provider request failed with HTTP 429.');
  await expect(nativeSuggestions('openai', 'm', 'p')).rejects.toThrow(message('quota', { provider: openai, host: 'platform.openai.com' }));
  invoke.mockRejectedValueOnce('AI provider request failed with HTTP 400.');
  await expect(nativeSuggestions('gemini', 'm', 'p')).rejects.toThrow(message('authFailed', { provider: i18n.t('legacyUi.ai.gemini') }));
  invoke.mockRejectedValueOnce('AI provider request failed with HTTP 503.');
  await expect(nativeText('openai', 'm', 'p')).rejects.toThrow(message('apiError', { provider: openai, status: 503, detail: message('responseHidden', {}) }));
});

it('translates a missing credential and passes other native failures through', async () => {
  invoke.mockRejectedValueOnce('AI provider credential is not configured.');
  await expect(nativeText('openai', 'm', 'p')).rejects.toThrow(message('credentialMissing', { provider: openai }));
  invoke.mockRejectedValueOnce('AI provider request failed.');
  await expect(nativeText('openai', 'm', 'p')).rejects.toThrow('AI provider request failed.');
  const original = new Error('Invalid AI prompt.');
  invoke.mockRejectedValueOnce(original);
  await expect(nativeText('openai', 'm', 'p')).rejects.toBe(original);
});

it('reports a rejected model only when a model is known', () => {
  expect(aiResponseError('openai', 400).message).toBe(message('apiError', { provider: openai, status: 400, detail: message('responseHidden', {}) }));
  expect(aiResponseError('claude', 404, false, 'claude-x').message).toBe(message('modelRejected', { provider: i18n.t('legacyUi.ai.claude'), model: 'claude-x', status: 404 }));
});
