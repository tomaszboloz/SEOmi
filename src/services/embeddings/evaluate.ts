import type { EmbeddingProvider, LabelledText, Vector } from './types.ts';
import { topK } from './vector.ts';

export interface EvaluationReport {
  provider: string;
  model: string;
  k: number;
  total: number;
  correct: number;
  /** Share of texts whose nearest neighbours vote for their own label (0..1). */
  accuracy: number;
  perLabel: Record<string, { total: number; correct: number; accuracy: number }>;
  misses: Array<{ text: string; expected: string; predicted: string }>;
}

/** Majority label of the neighbours; ties go to the most similar neighbour's label. */
export const voteLabel = (neighbours: Array<{ label: string; score: number }>): string => {
  const votes = new Map<string, number>();
  for (const { label, score } of neighbours) votes.set(label, (votes.get(label) ?? 0) + Math.max(score, 0) + 1e-9);
  return [...votes.entries()].sort((left, right) => right[1] - left[1])[0]?.[0] ?? '';
};

/**
 * Leave-one-out k-nearest-neighbour accuracy: every labelled text is classified
 * by its `k` most similar *other* texts. It measures whether texts that belong
 * together are embedded close to each other, which is what clustering and
 * semantic matching rely on.
 */
export const evaluateProvider = async (provider: EmbeddingProvider, dataset: LabelledText[], k = 3): Promise<EvaluationReport> => {
  if (dataset.length < 2) throw new Error('An evaluation dataset needs at least two labelled texts');
  const vectors: Vector[] = await provider.embed(dataset.map((item) => item.text));
  const perLabel: EvaluationReport['perLabel'] = {};
  const misses: EvaluationReport['misses'] = [];
  let correct = 0;
  dataset.forEach((item, index) => {
    const neighbours = topK(vectors[index], vectors, k, index).map((match) => ({ label: dataset[match.index].label, score: match.score }));
    const predicted = voteLabel(neighbours);
    const bucket = (perLabel[item.label] ??= { total: 0, correct: 0, accuracy: 0 });
    bucket.total += 1;
    if (predicted === item.label) {
      correct += 1;
      bucket.correct += 1;
    } else {
      misses.push({ text: item.text, expected: item.label, predicted });
    }
  });
  for (const bucket of Object.values(perLabel)) bucket.accuracy = bucket.correct / bucket.total;
  return { provider: provider.id, model: provider.model, k, total: dataset.length, correct, accuracy: correct / dataset.length, perLabel, misses };
};

/** Validates a parsed dataset file: `[{ "text": "...", "label": "..." }, ...]`. */
export const parseDataset = (value: unknown): LabelledText[] => {
  if (!Array.isArray(value)) throw new Error('Dataset must be a JSON array');
  return value.map((item, index) => {
    const text = (item as Partial<LabelledText>)?.text;
    const label = (item as Partial<LabelledText>)?.label;
    if (typeof text !== 'string' || !text.trim() || typeof label !== 'string' || !label.trim()) throw new Error(`Dataset item ${index} needs non-empty text and label`);
    return { text: text.trim(), label: label.trim() };
  });
};
