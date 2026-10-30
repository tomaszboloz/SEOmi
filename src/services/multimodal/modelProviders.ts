import type { ModelAnalysis } from './unavailable';

/**
 * Provider interface for analyses that need a local model (#96: OCR, CLIP/M-CLIP alignment, transcripts).
 * Every artifact carries its provenance; low confidence stays partial and is never promoted to a verified
 * fact. No provider is registered in this build, so each analysis resolves to "unavailable" and the
 * technical alt/size audit is unaffected.
 */
export interface ModelProvenance {
  provider: string;
  model: string;
  modelVersion: string;
  language: string | null;
  /** 0-1 as reported by the model; null when the model reports none. */
  confidence: number | null;
  sourceUrl: string;
  contentHash: string;
  analyzedAt: string;
}
export interface OcrArtifact { text: string; bbox: [number, number, number, number]; provenance: ModelProvenance }
export interface AlignmentArtifact { similarity: number; dimension: number; textSource: 'alt' | 'paragraph'; provenance: ModelProvenance }
export interface TranscriptArtifact { segments: Array<{ startMs: number; endMs: number; text: string }>; provenance: ModelProvenance }

export interface ModelArtifacts { ocr: OcrArtifact[]; 'clip-alignment': AlignmentArtifact; transcript: TranscriptArtifact }
export interface ModelInput { url: string; bytes: Blob; contentHash: string; context?: { alt?: string; paragraph?: string } }
export interface ModelProvider<K extends ModelAnalysis> {
  analysis: K;
  id: string;
  analyze: (input: ModelInput, signal: AbortSignal) => Promise<ModelArtifacts[K]>;
}
export type ModelProviderRegistry = { [K in ModelAnalysis]?: ModelProvider<K> };

/** Empty on purpose: register a provider only when a real local model path exists. */
export const MODEL_PROVIDERS: Readonly<ModelProviderRegistry> = Object.freeze({});

export const resolveModelProvider = <K extends ModelAnalysis>(analysis: K, registry: ModelProviderRegistry = MODEL_PROVIDERS): ModelProvider<K> | null =>
  (registry[analysis] as ModelProvider<K> | undefined) ?? null;

/** Comparing with external image search results needs an images provider; none is configured. */
export const externalImageSearchState = () => ({ status: 'unavailable' as const, reason: 'no-images-provider' as const });
