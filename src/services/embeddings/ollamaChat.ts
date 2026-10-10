import { z } from 'zod';
import type { OllamaOptions } from './ollama.ts';
import { boundedOllamaInteger, ollamaSettings, postOllama } from './ollamaTransport.ts';

export const MAX_OLLAMA_CHAT_MESSAGES = 32;
export const MAX_OLLAMA_CHAT_MESSAGE_CHARS = 16_000;
export const MAX_OLLAMA_CHAT_REQUEST_BYTES = 256 * 1024;
export const MAX_OLLAMA_CHAT_RESPONSE_CHARS = 20_000;
export const MAX_OLLAMA_CHAT_OUTPUT_TOKENS = 4_096;
export const DEFAULT_OLLAMA_CHAT_OUTPUT_TOKENS = 2_048;

export type OllamaChatRole = 'system' | 'user' | 'assistant';
export interface OllamaChatMessage { role: OllamaChatRole; content: string; }
export interface OllamaChatOptions extends OllamaOptions { maxOutputTokens?: number; }
export interface OllamaChatUsage {
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
}
export interface OllamaChatResult { model: string; text: string; usage: OllamaChatUsage; }

const messageSchema = z.object({
  role: z.enum(['system', 'user', 'assistant']),
  content: z.string().min(1).max(MAX_OLLAMA_CHAT_MESSAGE_CHARS),
}).strict();

const responseSchema = z.object({
  model: z.string().min(1).max(200).refine((value) => value.trim().length > 0),
  created_at: z.string().max(100).optional(),
  message: z.object({ role: z.literal('assistant'), content: z.string().max(MAX_OLLAMA_CHAT_RESPONSE_CHARS) }).strict(),
  done: z.literal(true),
  done_reason: z.string().max(80).optional(),
  total_duration: z.number().int().nonnegative().optional(),
  load_duration: z.number().int().nonnegative().optional(),
  prompt_eval_count: z.number().int().nonnegative().optional(),
  prompt_eval_duration: z.number().int().nonnegative().optional(),
  eval_count: z.number().int().nonnegative().optional(),
  eval_duration: z.number().int().nonnegative().optional(),
}).strict();

const modelName = (value: string | undefined): string => {
  const parsed = z.string().trim().min(1).max(200).safeParse(value ?? '');
  if (!parsed.success) throw new Error('Invalid Ollama chat model');
  return parsed.data;
};

const requestBody = (model: string, messages: OllamaChatMessage[], maxOutputTokens: number): Record<string, unknown> => {
  const body = { model, messages, stream: false, options: { temperature: 0, num_predict: maxOutputTokens } };
  const bytes = new TextEncoder().encode(JSON.stringify(body)).byteLength;
  if (bytes > MAX_OLLAMA_CHAT_REQUEST_BYTES) throw new Error('Ollama chat request too large');
  return body;
};

export const parseOllamaChatResponse = (value: unknown): OllamaChatResult => {
  const parsed = responseSchema.safeParse(value);
  if (!parsed.success) throw new Error('Ollama returned an invalid chat response');
  return {
    model: parsed.data.model,
    text: parsed.data.message.content,
    usage: {
      promptTokens: parsed.data.prompt_eval_count ?? null,
      completionTokens: parsed.data.eval_count ?? null,
      totalTokens: null,
    },
  };
};

export const createOllamaChat = (options: OllamaChatOptions = {}) => {
  const resolved = ollamaSettings(options);
  const model = modelName(options.model);
  const maxOutputTokens = boundedOllamaInteger(options.maxOutputTokens ?? DEFAULT_OLLAMA_CHAT_OUTPUT_TOKENS, MAX_OLLAMA_CHAT_OUTPUT_TOKENS, 'output tokens');
  return async (messages: OllamaChatMessage[]): Promise<OllamaChatResult> => {
    const parsed = z.array(messageSchema).min(1).max(MAX_OLLAMA_CHAT_MESSAGES).safeParse(messages);
    if (!parsed.success) throw new Error('Invalid Ollama chat messages');
    return parseOllamaChatResponse(await postOllama(resolved, '/api/chat', requestBody(model, parsed.data, maxOutputTokens)));
  };
};
