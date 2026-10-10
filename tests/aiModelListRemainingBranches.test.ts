import { describe, expect, it, vi } from 'vitest';
import { listProviderModels } from '@/services/ai/modelList';

const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });

describe('model list fallback branches', () => {
  it('sorts models with missing dates by id after dated models', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(json({ data: [
      { id: 'gpt-z' }, { id: 'gpt-a' }, { id: 'gpt-new', created: 2 }, { id: 'gpt-old', created: 1 },
    ] }));
    expect((await listProviderModels('openai', 'key', fetchImpl)).map(model => model.id))
      .toEqual(['gpt-new', 'gpt-old', 'gpt-a', 'gpt-z']);
  });

  it('rejects Gemini models without generation methods as well as unsupported methods', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(json({ models: [
      { name: 'models/gemini-no-method' },
      { name: 'models/gemini-predict', supportedGenerationMethods: ['predict'] },
      { name: 'models/gemini-ok', supportedGenerationMethods: ['generateContent'] },
    ] }));
    expect(await listProviderModels('gemini', 'key', fetchImpl)).toEqual([
      { id: 'gemini-ok', label: 'gemini-ok' },
    ]);
  });
});
