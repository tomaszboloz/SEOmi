import { describe, expect, it, vi } from 'vitest';
import { FALLBACK_MODELS, ModelListError, listProviderModels, modelOptionsFor } from '@/services/ai/modelList';
import { isHiddenModel } from '@/services/ai/modelCatalog';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

describe('OpenAI model listing', () => {
  it('keeps text-generation models, newest first, and hides o3-mini and non-chat models', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(json({ data: [
      { id: 'gpt-4o-mini', created: 1 }, { id: 'gpt-6-astra', created: 9 }, { id: 'o3-mini', created: 5 },
      { id: 'text-embedding-3-large', created: 8 }, { id: 'gpt-4o-realtime-preview', created: 7 }, { id: 'whisper-1', created: 6 },
      { id: 'dall-e-3', created: 4 }, { id: 'o4-mini', created: 3 }, { id: 'gpt-4o-mini', created: 1 },
    ] }));
    const models = await listProviderModels('openai', ' key ', fetchImpl);
    expect(models.map(model => model.id)).toEqual(['gpt-6-astra', 'o4-mini', 'gpt-4o-mini']);
    expect(fetchImpl).toHaveBeenCalledWith('https://api.openai.com/v1/models', { headers: { Authorization: 'Bearer key' } });
  });

  it('reports HTTP failures and malformed bodies as errors', async () => {
    await expect(listProviderModels('openai', 'key', vi.fn().mockResolvedValue(json({}, 401)))).rejects.toBeInstanceOf(ModelListError);
    await expect(listProviderModels('openai', 'key', vi.fn().mockResolvedValue(json({ data: 'x' })))).rejects.toThrow();
  });

  it('does not call the API without a key', async () => {
    const fetchImpl = vi.fn();
    expect(await listProviderModels('openai', '  ', fetchImpl)).toEqual([]);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe('Claude model listing', () => {
  it('follows pagination and uses display names', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(json({ data: [{ id: 'claude-opus-5', display_name: 'Claude Opus 5' }], has_more: true, last_id: 'claude-opus-5' }))
      .mockResolvedValueOnce(json({ data: [{ id: 'claude-haiku-4-5' }, { id: 'claude-3-5-haiku-20241022' }], has_more: false, last_id: null }));
    const models = await listProviderModels('claude', 'key', fetchImpl);
    expect(models).toEqual([{ id: 'claude-opus-5', label: 'Claude Opus 5' }, { id: 'claude-haiku-4-5', label: 'claude-haiku-4-5' }]);
    expect(String(fetchImpl.mock.calls[1][0])).toContain('after_id=claude-opus-5');
    expect(fetchImpl.mock.calls[0][1].headers).toEqual({ 'x-api-key': 'key', 'anthropic-version': '2023-06-01' });
  });

  it('stops after a bounded number of pages', async () => {
    const fetchImpl = vi.fn().mockImplementation(async () => json({ data: [{ id: `m-${Math.random()}` }], has_more: true, last_id: 'x' }));
    await listProviderModels('claude', 'key', fetchImpl);
    expect(fetchImpl).toHaveBeenCalledTimes(5);
  });
});

describe('Gemini model listing', () => {
  it('keeps only Gemini generateContent models and follows page tokens', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(json({ models: [
        { name: 'models/gemini-3.8-flash', displayName: 'Gemini 3.8 Flash', supportedGenerationMethods: ['generateContent'] },
        { name: 'models/gemini-embedding-001', supportedGenerationMethods: ['embedContent'] },
        { name: 'models/imagen-4', supportedGenerationMethods: ['predict'] },
      ], nextPageToken: 'p2' }))
      .mockResolvedValueOnce(json({ models: [{ name: 'models/gemini-2.0-flash', supportedGenerationMethods: ['generateContent'] }] }));
    expect(await listProviderModels('gemini', 'k&x', fetchImpl)).toEqual([{ id: 'gemini-3.8-flash', label: 'Gemini 3.8 Flash' }]);
    expect(String(fetchImpl.mock.calls[0][0])).toContain('key=k%26x');
    expect(String(fetchImpl.mock.calls[1][0])).toContain('pageToken=p2');
  });
});

describe('model options', () => {
  it('uses fallbacks until a list is fetched and always keeps the current model', () => {
    expect(modelOptionsFor('claude', [], 'claude-opus-5')).toBe(FALLBACK_MODELS.claude);
    expect(modelOptionsFor('openai', [{ id: 'gpt-6-astra', label: 'gpt-6-astra' }], 'custom')[0]).toEqual({ id: 'custom', label: 'custom' });
    expect(modelOptionsFor('openai', undefined, '')).toBe(FALLBACK_MODELS.openai);
  });

  it('never offers o3-mini or retired models as defaults', () => {
    expect(isHiddenModel('o3-mini')).toBe(true);
    expect(Object.values(FALLBACK_MODELS).flat().some(model => isHiddenModel(model.id))).toBe(false);
  });
});
