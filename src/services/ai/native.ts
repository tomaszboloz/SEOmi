import type { AiProvider } from '@/types';
import { invokeTauriCommand } from '@/services/tauri';
import { readAiResponseText } from './response';

export const isDesktopAi = (): boolean =>
  typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

const nativeResponse = (raw: string): Response =>
  new Response(raw, { headers: { 'Content-Type': 'application/json' } });

export async function nativeText(provider: AiProvider, model: string, prompt: string): Promise<string> {
  const raw = await invokeTauriCommand<string>('ai_generate_text', { provider, model, prompt });
  return readAiResponseText(nativeResponse(raw), provider);
}

export async function nativeSuggestions(provider: AiProvider, model: string, prompt: string): Promise<string> {
  const raw = await invokeTauriCommand<string>('ai_generate_suggestions', { provider, model, prompt });
  return readAiResponseText(nativeResponse(raw), provider);
}
