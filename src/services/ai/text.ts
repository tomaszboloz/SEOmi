import type { AiProvider, AiConnectionMethod } from '@/types';
import { invokeTauriCommand } from '@/services/tauri';
import i18n from '@/i18n';
import { aiProviderLabel } from './labels';
import { requestClaudeText } from './claude';

export async function generateAiText(provider: AiProvider, apiKey: string, model: string, prompt: string, method: AiConnectionMethod = 'api_key'): Promise<string> {
  // A subscription CLI owns its own model selection and authentication.
  // Do not force the API-oriented model name from this UI onto Codex,
  // Claude Code or Gemini CLI: that would make an already logged-in CLI fail
  // despite a valid subscription.
  if (method === 'local_cli') return invokeTauriCommand<string>('run_ai_cli', { provider, prompt });
  if (!apiKey.trim()) throw new Error(i18n.t('runtimeErrors.ai.credentialMissing', { provider: aiProviderLabel(provider) }));
  if (provider === 'openai') {
    const response = await fetch('https://api.openai.com/v1/chat/completions', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` }, body: JSON.stringify({ model, messages: [{ role: 'user', content: prompt }], temperature: 0 }) });
    if (!response.ok) throw new Error(i18n.t('runtimeErrors.ai.apiError', { provider: aiProviderLabel('openai'), status: response.status, detail: await response.text() }));
    return (await response.json()).choices?.[0]?.message?.content || '';
  }
  if (provider === 'claude') {
    const response = await requestClaudeText(apiKey, model, prompt);
    if (typeof response === 'string') return response;
    throw new Error(i18n.t('runtimeErrors.ai.apiError', { provider: aiProviderLabel('claude'), status: response.status, detail: await response.text() }));
  }
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }) });
  if (!response.ok) throw new Error(i18n.t('runtimeErrors.ai.apiError', { provider: aiProviderLabel('gemini'), status: response.status, detail: await response.text() }));
  return (await response.json()).candidates?.[0]?.content?.parts?.[0]?.text || '';
}
