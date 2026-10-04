import type { AiProvider, AiConnectionMethod } from '@/types';
import { invokeTauriCommand } from '@/services/tauri';
import i18n from '@/i18n';
import { aiProviderLabel } from './labels';
import { aiResponseError, readAiResponseText } from './response';
import { requestClaude } from './claude';
import { GEMINI_DEFAULT_MODEL, currentModel } from './modelCatalog';

export async function generateAiText(provider: AiProvider, apiKey: string, model: string, prompt: string, method: AiConnectionMethod = 'api_key'): Promise<string> {
  // A subscription CLI owns its own model selection and authentication.
  // Do not force the API-oriented model name from this UI onto Codex,
  // Claude Code or Gemini CLI: that would make an already logged-in CLI fail
  // despite a valid subscription.
  if (method === 'local_cli') return invokeTauriCommand<string>('run_ai_cli', { provider, prompt });
  if (!apiKey.trim()) throw new Error(i18n.t('runtimeErrors.ai.credentialMissing', { provider: aiProviderLabel(provider) }));
  if (provider === 'openai') {
    const response = await fetch('https://api.openai.com/v1/chat/completions', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` }, body: JSON.stringify({ model, messages: [{ role: 'user', content: prompt }], temperature: 0 }) });
    if (!response.ok) throw aiResponseError(provider, response.status);
    return readAiResponseText(response, provider);
  }
  if (provider === 'claude') {
    const response = await requestClaude(apiKey, model, prompt);
    if (!response.ok) throw aiResponseError(provider, response.status);
    return readAiResponseText(response, provider);
  }
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(currentModel(model || GEMINI_DEFAULT_MODEL))}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }) });
  if (!response.ok) throw aiResponseError(provider, response.status);
  return readAiResponseText(response, provider);
}
