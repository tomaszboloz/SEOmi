import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { isDesktopAi, nativeSuggestions, nativeText } from '@/services/ai/native';

const invoke = vi.hoisted(() => vi.fn());
vi.mock('@/services/tauri', () => ({ invokeTauriCommand: invoke }));

beforeEach(() => {
  invoke.mockReset().mockResolvedValue(JSON.stringify({ choices: [{ message: { content: 'native answer' } }] }));
  delete (window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__;
});
afterEach(() => vi.restoreAllMocks());

it('detects the native shell without treating a browser preview as desktop', () => {
  expect(isDesktopAi()).toBe(false);
  Object.defineProperty(window, '__TAURI_INTERNALS__', { configurable: true, value: {} });
  expect(isDesktopAi()).toBe(true);
});

it('routes native text and suggestion requests with only provider inputs', async () => {
  await expect(nativeText('openai', 'gpt-test', 'literal prompt')).resolves.toBe('native answer');
  await expect(nativeSuggestions('openai', 'gpt-test', 'literal prompt')).resolves.toBe('native answer');
  expect(invoke.mock.calls).toEqual([
    ['ai_generate_text', { provider: 'openai', model: 'gpt-test', prompt: 'literal prompt' }],
    ['ai_generate_suggestions', { provider: 'openai', model: 'gpt-test', prompt: 'literal prompt' }],
  ]);
});
