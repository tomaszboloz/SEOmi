import type { OllamaOptions } from '@/services/embeddings/ollama';
import { ollamaSettings, postOllama } from '@/services/embeddings/ollamaTransport';
import type { ModelInput, ModelProvider, OcrArtifact } from './modelProviders';

/**
 * Optional OCR through a local Ollama vision model (#96 GEM-96-05/08). Nothing is installed or downloaded
 * by SEOmi: the user points it at a model they already run (e.g. `llava`, `llama3.2-vision`). A vision LLM
 * gives no per-line boxes or confidence, so every line gets the whole-image box and `confidence: null`;
 * downstream that stays `partial`, never a verified fact. Image bytes go only to the configured Ollama origin.
 */
export const OLLAMA_OCR_PROVIDER = 'ollama-vision';
export const MAX_OCR_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_OCR_LINES = 200;
const MAX_LINE_CHARS = 500;
const PROMPT = 'Transcribe every piece of readable text in this image, one line per text line, in the original language. Output only the text. If there is no text, output NONE.';

export interface OllamaOcrOptions extends Omit<OllamaOptions, 'batchSize'> {
  model: string;
  now?: () => string;
}

const toBase64 = async (blob: Blob): Promise<string> => {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  for (let index = 0; index < bytes.length; index += 0x8000) binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  return btoa(binary);
};

const cancelled = () => Object.assign(new Error('OCR cancelled'), { name: 'AbortError' });

/** Splits the model reply into bounded text lines; `NONE` or an empty reply means no text. */
export const ocrLines = (reply: string): string[] =>
  reply.split(/\r?\n/u).map((line) => line.replace(/^\s*(?:[-*•]|\d+[.)])\s+/u, '').trim()).filter((line) => line && line.toUpperCase() !== 'NONE')
    .slice(0, MAX_OCR_LINES).map((line) => line.slice(0, MAX_LINE_CHARS));

export const createOllamaOcrProvider = (options: OllamaOcrOptions): ModelProvider<'ocr'> => {
  const model = options.model.trim();
  if (!model) throw new Error('An Ollama vision model name is required for OCR');
  const settings = ollamaSettings(options);
  return {
    analysis: 'ocr',
    id: OLLAMA_OCR_PROVIDER,
    analyze: async (input: ModelInput, signal: AbortSignal): Promise<OcrArtifact[]> => {
      if (signal.aborted) throw cancelled();
      if (input.bytes.size > MAX_OCR_IMAGE_BYTES) throw new Error('Image too large for OCR');
      if (input.bytes.type && !input.bytes.type.startsWith('image/')) throw new Error('Not an image');
      const body = await postOllama(settings, '/api/generate', { model, prompt: PROMPT, images: [await toBase64(input.bytes)], stream: false, options: { temperature: 0 } });
      if (signal.aborted) throw cancelled();
      if (typeof body.response !== 'string') throw new Error('Ollama returned no text');
      const analyzedAt = options.now?.() ?? new Date().toISOString();
      return ocrLines(body.response).map((text) => ({
        text,
        bbox: [0, 0, 1, 1],
        provenance: {
          provider: OLLAMA_OCR_PROVIDER, model, modelVersion: 'unknown', language: null, confidence: null,
          sourceUrl: input.url, contentHash: input.contentHash, analyzedAt,
        },
      }));
    },
  };
};
