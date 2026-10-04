import type { AiProvider } from '@/types';
import i18n from '@/i18n';
import { aiProviderLabel } from './labels';
import { CLAUDE_CONNECTION_PROBE_MODEL, CLAUDE_MESSAGES_URL, claudeHeaders } from './claude';

export async function testAiConnection(
  provider: AiProvider,
  apiKey: string
): Promise<{ success: boolean; message: string }> {
  if (!apiKey.trim()) {
    return { success: false, message: i18n.t('runtimeErrors.ai.keyRequired') };
  }

  try {
    if (provider === 'openai') {
      const res = await fetch('https://api.openai.com/v1/models', {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      if (!res.ok) {
        if (res.status === 401) {
          return { success: false, message: i18n.t('runtimeErrors.ai.invalidKey', { provider: aiProviderLabel('openai') }) };
        }
        if (res.status === 429) {
          return { success: false, message: i18n.t('runtimeErrors.ai.quotaExceeded', { provider: aiProviderLabel('openai') }) };
        }
        return { success: false, message: i18n.t('runtimeErrors.ai.responded', { provider: aiProviderLabel('openai'), status: res.status }) };
      }
      return { success: true, message: i18n.t('runtimeErrors.ai.connected', { provider: aiProviderLabel('openai') }) };
    }

    if (provider === 'claude') {
      const res = await fetch(CLAUDE_MESSAGES_URL, {
        method: 'POST',
        headers: claudeHeaders(apiKey, CLAUDE_CONNECTION_PROBE_MODEL),
        body: JSON.stringify({
          model: CLAUDE_CONNECTION_PROBE_MODEL,
          max_tokens: 5,
          messages: [{ role: 'user', content: 'ping' }],
        }),
      });
      if (!res.ok) {
        if (res.status === 401) {
          return { success: false, message: i18n.t('runtimeErrors.ai.invalidKey', { provider: aiProviderLabel('claude') }) };
        }
        if (res.status === 429) {
          return { success: false, message: i18n.t('runtimeErrors.ai.quotaExceeded', { provider: aiProviderLabel('claude') }) };
        }
        return { success: false, message: i18n.t('runtimeErrors.ai.responded', { provider: aiProviderLabel('claude'), status: res.status }) };
      }
      return { success: true, message: i18n.t('runtimeErrors.ai.connected', { provider: aiProviderLabel('claude') }) };
    }

    if (provider === 'gemini') {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`
      );
      if (!res.ok) {
        if (res.status === 400 || res.status === 403) {
          return { success: false, message: i18n.t('runtimeErrors.ai.invalidKey', { provider: aiProviderLabel('gemini') }) };
        }
        if (res.status === 429) {
          return { success: false, message: i18n.t('runtimeErrors.ai.quotaExceeded', { provider: aiProviderLabel('gemini') }) };
        }
        return { success: false, message: i18n.t('runtimeErrors.ai.responded', { provider: aiProviderLabel('gemini'), status: res.status }) };
      }
      return { success: true, message: i18n.t('runtimeErrors.ai.connected', { provider: aiProviderLabel('gemini') }) };
    }

    return { success: false, message: i18n.t('runtimeErrors.ai.unsupported') };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, message: i18n.t('runtimeErrors.ai.network', { detail: msg }) };
  }
}
