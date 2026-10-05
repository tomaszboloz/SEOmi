/** A unit-length (L2-normalised) embedding vector. */
export type Vector = Float64Array;

/**
 * Any embedding backend. Add a new backend by implementing this contract and
 * registering a factory in `registry.ts`; the evaluator, clustering and CLI
 * work with every provider unchanged.
 */
export interface EmbeddingProvider {
  /** Stable identifier written next to each vector, e.g. `local-hash` or `ollama`. */
  readonly id: string;
  /** Model or configuration name; vectors from different models are not comparable. */
  readonly model: string;
  embed(texts: string[]): Promise<Vector[]>;
}

/** Labelled examples used to measure retrieval accuracy. */
export interface LabelledText {
  text: string;
  label: string;
}

export interface EmbeddedText {
  id: string;
  text: string;
  provider: string;
  model: string;
  vector: number[];
}
