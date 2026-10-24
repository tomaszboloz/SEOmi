import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { invokeTauriCommand } from '@/services/tauri';
import { currentModel, isHiddenModel } from '@/services/ai/modelCatalog';
import { listProviderModels, modelOptionsFor } from '@/services/ai/modelList';

vi.mock('@/services/tauri', () => ({ invokeTauriCommand: vi.fn() }));

const invoke = vi.mocked(invokeTauriCommand);
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status });

beforeEach(() => {
  invoke.mockReset();
  delete (window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__;
});

afterEach(() => {
  delete (window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__;
});

describe('provider model list boundaries', () => {
  it('filters and orders OpenAI chat models while removing duplicate ids', async () => {
    const urls: string[] = [];
    const models = await listProviderModels('openai', ' key ', async (input) => {
      urls.push(input);
      return json({ data: [
        { id: 'gpt-4o', created: 1 }, { id: 'text-embedding-3-small', created: 9 },
        { id: 'gpt-4o', created: 4 }, { id: 'gpt-4o-mini', created: 3 },
      ] });
    });
    expect(urls).toEqual(['https://api.openai.com/v1/models']);
    expect(models).toEqual([{ id: 'gpt-4o', label: 'gpt-4o' }, { id: 'gpt-4o-mini', label: 'gpt-4o-mini' }]);
  });

  it('follows Claude pagination and keeps a fallback label for missing display names', async () => {
    const urls: string[] = [];
    const pages = [
      { data: [{ id: 'claude-sonnet-5', display_name: 'Sonnet' }], has_more: true, last_id: 'page-1' },
      { data: [{ id: 'claude-haiku-4-5' }], has_more: false, last_id: null },
    ];
    const models = await listProviderModels('claude', 'key', async (input) => {
      urls.push(input);
      return json(pages.shift());
    });
    expect(urls[1]).toContain('after_id=page-1');
    expect(models).toEqual([{ id: 'claude-sonnet-5', label: 'Sonnet' }, { id: 'claude-haiku-4-5', label: 'claude-haiku-4-5' }]);
  });

  it('keeps only Gemini text-generation models across pages', async () => {
    const pages = [
      { models: [
        { name: 'models/gemini-3.8-flash', supportedGenerationMethods: ['generateContent'] },
        { name: 'models/gemini-tts', supportedGenerationMethods: ['generateContent'] },
        { name: 'models/gemini-2', supportedGenerationMethods: ['embedContent'] },
      ], nextPageToken: 'next' },
      { models: [{ name: 'models/gemini-3.1-pro-preview', displayName: 'Pro', supportedGenerationMethods: ['generateContent'] }] },
    ];
    const models = await listProviderModels('gemini', 'key', async () => json(pages.shift()));
    expect(models).toEqual([
      { id: 'gemini-3.8-flash', label: 'gemini-3.8-flash' },
      { id: 'gemini-3.1-pro-preview', label: 'Pro' },
    ]);
  });

  it('uses native models on desktop and removes retired ids', async () => {
    (window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__ = {};
    invoke.mockResolvedValue([
      { id: 'o3-mini', label: 'retired' },
      { id: 'gpt-5.4', label: 'current' },
    ]);
    await expect(listProviderModels('openai', 'ignored')).resolves.toEqual([{ id: 'gpt-5.4', label: 'current' }]);
    expect(invoke).toHaveBeenCalledWith('ai_list_models', { provider: 'openai' });
  });

  it('keeps the selected model visible and maps retired preferences', () => {
    expect(currentModel('o3-mini')).toBe('gpt-4o-mini');
    expect(isHiddenModel('o3-mini')).toBe(true);
    expect(modelOptionsFor('openai', [], 'custom-model')[0]).toEqual({ id: 'custom-model', label: 'custom-model' });
    expect(modelOptionsFor('openai', [{ id: 'gpt-4o', label: 'GPT' }], 'gpt-4o')).toEqual([{ id: 'gpt-4o', label: 'GPT' }]);
  });
});
