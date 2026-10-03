import { z } from 'zod';
import type { AiProvider } from '@/types';
import i18n from '@/i18n';
import { aiProviderLabel } from './labels';

export const MAX_AI_RESPONSE_BYTES = 1024 * 1024;
const schemas = {
  openai: z.object({ choices: z.array(z.object({ message: z.object({ content: z.string().nullish() }) })).optional() }),
  claude: z.object({ content: z.array(z.object({ text: z.string().nullish() })).optional() }),
  gemini: z.object({ candidates: z.array(z.object({ content: z.object({ parts: z.array(z.object({ text: z.string().nullish() })) }) })).optional() }),
};

/** Preserve status evidence without reading or exposing provider error bodies. */
export function aiResponseError(provider: AiProvider, status: number, suggestion = false): Error {
  const label = aiProviderLabel(provider);
  if (suggestion && (status === 401 || (provider === 'gemini' && (status === 400 || status === 403)))) {
    return new Error(i18n.t('runtimeErrors.ai.authFailed', { provider: label }));
  }
  if (suggestion && status === 429) {
    const host = { openai: 'platform.openai.com', claude: 'console.anthropic.com', gemini: 'aistudio.google.com' }[provider];
    return new Error(i18n.t('runtimeErrors.ai.quota', { provider: label, host }));
  }
  return new Error(i18n.t('runtimeErrors.ai.apiError', {
    provider: label, status, detail: i18n.t('runtimeErrors.ai.responseHidden'),
  }));
}

/** Apply the limit to streamed bytes, regardless of Content-Length. */
export async function readAiResponseText(response: Response, provider: AiProvider): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) throw new Error(i18n.t('runtimeErrors.ai.invalidResponse'));
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  let value: unknown;
  try {
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > MAX_AI_RESPONSE_BYTES) throw new Error(i18n.t('runtimeErrors.ai.responseTooLarge'));
      chunks.push(chunk.value);
    }
    const buffer = new Uint8Array(bytes);
    let offset = 0;
    for (const chunk of chunks) { buffer.set(chunk, offset); offset += chunk.byteLength; }
    value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(buffer));
  } catch {
    await reader.cancel().catch(() => undefined);
    if (bytes > MAX_AI_RESPONSE_BYTES) throw new Error(i18n.t('runtimeErrors.ai.responseTooLarge'));
    // JSON syntax and transport errors may contain private response bytes.
    throw new Error(i18n.t('runtimeErrors.ai.invalidResponse'));
  } finally { reader.releaseLock(); }
  const parsed = schemas[provider].safeParse(value);
  if (!parsed.success) throw new Error(i18n.t('runtimeErrors.ai.invalidResponse'));
  if (provider === 'openai') return schemas.openai.parse(value).choices?.[0]?.message.content ?? '';
  if (provider === 'claude') return schemas.claude.parse(value).content?.[0]?.text ?? '';
  return schemas.gemini.parse(value).candidates?.[0]?.content.parts[0]?.text ?? '';
}
