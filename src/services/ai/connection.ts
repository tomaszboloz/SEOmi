import type { AiProvider } from '@/types';
import i18n from '@/i18n';
import { aiProviderLabel } from './labels';
import { CLAUDE_CONNECTION_PROBE_MODEL, CLAUDE_MODELS_URL, claudeHeaders } from './claude';
import { invokeTauriCommand } from '@/services/tauri';
import { isDesktopAi } from './native';

export async function testAiConnection(
  provider: AiProvider,
  apiKey: string
): Promise<{ success: boolean; message: string }> {
  if (!apiKey.trim()) {
    if (isDesktopAi()) {
      try {
        const result = await invokeTauriCommand<{ success: boolean; status: number | null }>('ai_test_connection', { provider });
        if (result.success) return { success: true, message: i18n.t('runtimeErrors.ai.connected', { provider: aiProviderLabel(provider) }) };
      } catch { /* The localized missing-key message below is safer than native details. */ }
    }
    return { success: false, message: i18n.t('runtimeErrors.ai.keyRequired') };
  }

  try {
    if (isDesktopAi()) {
      const result = await invokeTauriCommand<{ success: boolean; status: number | null }>('ai_test_connection', { provider });
      if (result.success) return { success: true, message: i18n.t('runtimeErrors.ai.connected', { provider: aiProviderLabel(provider) }) };
      const status = result.status ?? 0;
      if (status === 401 || (provider === 'gemini' && (status === 400 || status === 403))) return { success: false, message: i18n.t('runtimeErrors.ai.invalidKey', { provider: aiProviderLabel(provider) }) };
      if (status === 429) return { success: false, message: i18n.t('runtimeErrors.ai.quotaExceeded', { provider: aiProviderLabel(provider) }) };
      return { success: false, message: i18n.t('runtimeErrors.ai.responded', { provider: aiProviderLabel(provider), status }) };
    }
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
      // Models listing validates the credential without sending a billable
      // prompt/token request (the old `ping` Messages probe did).
      const res = await fetch(CLAUDE_MODELS_URL, {
        method: 'GET',
        headers: claudeHeaders(apiKey, CLAUDE_CONNECTION_PROBE_MODEL),
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
