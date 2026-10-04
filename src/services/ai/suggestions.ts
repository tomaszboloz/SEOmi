import { aiResponseError, readAiResponseText } from './response';
import { requestClaude } from './claude';
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

  if (!res.ok) throw aiResponseError('openai', res.status, true);

  return parseAiSuggestionResponse(await readAiResponseText(res, 'openai'));
}

export async function callClaude(
  apiKey: string,
  model: string,
  prompt: string
): Promise<AiSuggestionResponse> {
  const res = await requestClaude(apiKey, model, prompt);
  if (!res.ok) throw aiResponseError('claude', res.status, true);

  return parseAiSuggestionResponse(await readAiResponseText(res, 'claude'));
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

  if (!res.ok) throw aiResponseError('gemini', res.status, true);

  return parseAiSuggestionResponse(await readAiResponseText(res, 'gemini'));
}
