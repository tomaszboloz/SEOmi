import i18n from '@/i18n';
import { aiProviderLabel } from './labels';
import { parseAiSuggestionResponse, type AiSuggestionResponse } from './parsing';

export async function callOpenAI(
  apiKey: string,
  model: string,
  prompt: string
): Promise<AiSuggestionResponse> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.7,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    if (res.status === 401) {
      throw new Error(i18n.t('runtimeErrors.ai.authFailed', { provider: aiProviderLabel('openai') }));
    }
    if (res.status === 429) {
      throw new Error(i18n.t('runtimeErrors.ai.quota', { provider: aiProviderLabel('openai'), host: 'platform.openai.com' }));
    }
      throw new Error(i18n.t('runtimeErrors.ai.apiError', { provider: aiProviderLabel('openai'), status: res.status, detail: err }));
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  return parseAiSuggestionResponse(content || '');
}

export async function callClaude(
  apiKey: string,
  model: string,
  prompt: string
): Promise<AiSuggestionResponse> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    if (res.status === 401) {
      throw new Error(i18n.t('runtimeErrors.ai.authFailed', { provider: aiProviderLabel('claude') }));
    }
    if (res.status === 429) {
      throw new Error(i18n.t('runtimeErrors.ai.quota', { provider: aiProviderLabel('claude'), host: 'console.anthropic.com' }));
    }
      throw new Error(i18n.t('runtimeErrors.ai.apiError', { provider: aiProviderLabel('claude'), status: res.status, detail: err }));
  }

  const data = await res.json();
  const text = data.content?.[0]?.text || '';
  return parseAiSuggestionResponse(text);
}

export async function callGemini(
  apiKey: string,
  model: string,
  prompt: string
): Promise<AiSuggestionResponse> {
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: 'application/json',
      },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    if (res.status === 400 || res.status === 403) {
      throw new Error(i18n.t('runtimeErrors.ai.authFailed', { provider: aiProviderLabel('gemini') }));
    }
    if (res.status === 429) {
      throw new Error(i18n.t('runtimeErrors.ai.quota', { provider: aiProviderLabel('gemini'), host: 'aistudio.google.com' }));
    }
    throw new Error(i18n.t('runtimeErrors.ai.apiError', { provider: aiProviderLabel('gemini'), status: res.status, detail: err }));
  }

  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  return parseAiSuggestionResponse(text);
}
