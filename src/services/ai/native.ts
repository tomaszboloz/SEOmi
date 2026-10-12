import type { AiProvider } from '@/types';
import { invokeTauriCommand } from '@/services/tauri';
import i18n from '@/i18n';
import { currentModel, GEMINI_DEFAULT_MODEL } from './modelCatalog';
import { readAiResponseText } from './response';

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

export async function nativeText(provider: AiProvider, model: string, prompt: string): Promise<string> {
  const raw = await invokeTauriCommand<string>('ai_generate_text', { provider, model: nativeModel(provider, model), prompt });
  rejectProviderErrorEnvelope(raw);
  return readAiResponseText(nativeResponse(raw), provider);
}

export async function nativeSuggestions(provider: AiProvider, model: string, prompt: string): Promise<string> {
  const raw = await invokeTauriCommand<string>('ai_generate_suggestions', { provider, model: nativeModel(provider, model), prompt });
  rejectProviderErrorEnvelope(raw);
  return readAiResponseText(nativeResponse(raw), provider);
}
