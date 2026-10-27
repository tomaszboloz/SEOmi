import type { AiProvider } from '@/types';
import { invokeTauriCommand } from '@/services/tauri';
import i18n from '@/i18n';
import { currentModel, GEMINI_DEFAULT_MODEL } from './modelCatalog';
import { aiResponseError, readAiResponseText } from './response';
import { aiProviderLabel } from './labels';

export const isDesktopAi = (): boolean =>
  typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

const nativeResponse = (raw: string): Response =>
  new Response(raw, { headers: { 'Content-Type': 'application/json' } });

const nativeModel = (provider: AiProvider, model: string): string =>
  provider === 'gemini' ? currentModel(model || GEMINI_DEFAULT_MODEL) : model;

const rejectProviderErrorEnvelope = (raw: string): void => {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return;
  }
  if (value && typeof value === 'object' && !Array.isArray(value) && ('error' in value || 'error_code' in value)) {
    throw new Error(i18n.t('runtimeErrors.ai.invalidResponse'));
  }
};

const PROVIDER_STATUS = /HTTP (\d{3})/;

/** Turn the status-only native error into the translated message the WebView transport used to show. */
const invokeProvider = async (command: string, provider: AiProvider, model: string, prompt: string, suggestion: boolean): Promise<string> => {
  const sent = nativeModel(provider, model);
  try {
    return await invokeTauriCommand<string>(command, { provider, model: sent, prompt });
  } catch (cause) {
    const text = cause instanceof Error ? cause.message : String(cause);
    const status = Number(PROVIDER_STATUS.exec(text)?.[1]);
    if (status) throw aiResponseError(provider, status, suggestion, sent);
    if (text.includes('credential is not configured')) throw new Error(i18n.t('runtimeErrors.ai.credentialMissing', { provider: aiProviderLabel(provider) }), { cause });
    throw cause instanceof Error ? cause : new Error(text);
  }
};

export async function nativeText(provider: AiProvider, model: string, prompt: string): Promise<string> {
  const raw = await invokeProvider('ai_generate_text', provider, model, prompt, false);
  rejectProviderErrorEnvelope(raw);
  return readAiResponseText(nativeResponse(raw), provider);
}

export async function nativeSuggestions(provider: AiProvider, model: string, prompt: string): Promise<string> {
  const raw = await invokeProvider('ai_generate_suggestions', provider, model, prompt, true);
  rejectProviderErrorEnvelope(raw);
  return readAiResponseText(nativeResponse(raw), provider);
}
