import { z } from 'zod';
import type { OllamaOptions } from './ollama.ts';
import { getOllama, ollamaSettings } from './ollamaTransport.ts';

export const MAX_OLLAMA_DISCOVERED_MODELS = 300;
export const MAX_OLLAMA_MODEL_NAME_CHARS = 200;

export interface OllamaModelDetails {
  parent_model?: string;
  format?: string;
  family?: string;
  families?: string[] | null;
  parameter_size?: string;
  quantization_level?: string;
}
export interface OllamaModel {
  name: string;
  model?: string;
  modified_at?: string;
  size?: number;
  digest?: string;
  details?: OllamaModelDetails;
}
export interface OllamaDiscovery { version: string; models: OllamaModel[]; }

const boundedText = z.string().max(MAX_OLLAMA_MODEL_NAME_CHARS);
const detailsSchema = z.object({
  parent_model: boundedText.optional(),
  format: boundedText.optional(),
  family: boundedText.optional(),
  families: z.array(boundedText).max(32).nullable().optional(),
  parameter_size: boundedText.optional(),
  quantization_level: boundedText.optional(),
}).strict();
const modelSchema = z.object({
  name: boundedText.refine((value) => value.trim().length > 0),
  model: boundedText.optional(),
  modified_at: z.string().max(100).optional(),
  size: z.number().int().nonnegative().optional(),
  digest: z.string().max(200).optional(),
  details: detailsSchema.optional(),
}).strict();
const versionSchema = z.object({ version: z.string().min(1).max(120) }).strict();
const tagsSchema = z.object({ models: z.array(modelSchema).max(MAX_OLLAMA_DISCOVERED_MODELS) }).strict();

export const getOllamaVersion = async (options: OllamaOptions = {}): Promise<string> => {
  const parsed = versionSchema.safeParse(await getOllama(ollamaSettings(options), '/api/version'));
  if (!parsed.success) throw new Error('Ollama returned an invalid version response');
  return parsed.data.version;
};

export const getOllamaTags = async (options: OllamaOptions = {}): Promise<OllamaModel[]> => {
  const parsed = tagsSchema.safeParse(await getOllama(ollamaSettings(options), '/api/tags'));
  if (!parsed.success) throw new Error('Ollama returned an invalid tags response');
  return parsed.data.models;
};

export const discoverOllama = async (options: OllamaOptions = {}): Promise<OllamaDiscovery> => ({
  version: await getOllamaVersion(options),
  models: await getOllamaTags(options),
});
