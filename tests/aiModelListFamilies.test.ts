import { expect, it } from 'vitest';
import { listProviderModels } from '@/services/ai/modelList';
import { currentModel, isHiddenModel } from '@/services/ai/modelCatalog';
import { callOpenAI } from '@/services/ai/suggestions';
import { generateAiText } from '@/services/ai/text';

const json = (body: unknown) => Promise.resolve(new Response(JSON.stringify(body)));

it('offers no OpenAI model that chat completions rejects', async () => {
  const ids = ['gpt-5.5-pro', 'gpt-5.3-codex', 'gpt-live-1', 'gpt-3.5-turbo-instruct', 'gpt-5.3-chat-latest', 'gpt-5.4'];
  const listed = await listProviderModels('openai', 'k', () => json({ data: ids.map((id) => ({ id })) }));
  expect(listed.map((model) => model.id)).toEqual(['gpt-5.4']);
});

it('offers only text models of Gemini', async () => {
  const names = ['gemini-3.8-flash', 'gemini-3.8-flash-tts', 'gemini-3.1-flash-image', 'gemini-3.5-transcribe', 'gemini-robotics-er-2-preview', 'gemini-embedding-1'];
  const models = names.map((name) => ({ name: `models/${name}`, supportedGenerationMethods: ['generateContent'] }));
  const listed = await listProviderModels('gemini', 'k', () => json({ models }));
  expect(listed.map((model) => model.id)).toEqual(['gemini-3.8-flash']);
});

it('rewrites deprecated ids the OpenAI listing still returns', () => {
  for (const id of ['gpt-5-chat-latest', 'gpt-5.1-chat-latest', 'gpt-5.2-chat-latest', 'gpt-5.3-chat-latest']) {
    expect([isHiddenModel(id), currentModel(id)]).toEqual([true, 'gpt-5.4']);
  }
  expect(currentModel('gpt-3.5-turbo-1106')).toBe('gpt-3.5-turbo');
});

it('sends no temperature in the preview transport either', async () => {
  const bodies: Record<string, unknown>[] = [];
  const answer = { choices: [{ message: { content: '{"suggestedTitle":"T","suggestedDescription":"D","keyImprovements":["E"]}' } }] };
  const original = globalThis.fetch;
  globalThis.fetch = ((_url: string, init?: RequestInit) => { bodies.push(JSON.parse(String(init?.body))); return json(answer); }) as typeof fetch;
  try {
    await callOpenAI('k', 'gpt-6.1-sol', 'p');
    await generateAiText('openai', 'k', 'gpt-6.1-sol', 'p');
  } finally {
    globalThis.fetch = original;
  }
  expect(bodies).toHaveLength(2);
  expect(bodies.map((body) => 'temperature' in body)).toEqual([false, false]);
  expect(bodies[0].response_format).toEqual({ type: 'json_object' });
});
