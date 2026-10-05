import type { Vector } from './types.ts';

/** Returns a unit-length copy; a zero vector stays zero. */
export const normalize = (values: ArrayLike<number>): Vector => {
  let norm = 0;
  for (let index = 0; index < values.length; index += 1) norm += values[index] * values[index];
  const result = new Float64Array(values.length);
  if (norm === 0) return result;
  const scale = 1 / Math.sqrt(norm);
  for (let index = 0; index < values.length; index += 1) result[index] = values[index] * scale;
  return result;
};

/** Cosine similarity of two unit vectors (their dot product). */
export const cosine = (left: Vector, right: Vector): number => {
  if (left.length !== right.length) throw new Error(`Vector dimensions differ: ${left.length} vs ${right.length}`);
  let dot = 0;
  for (let index = 0; index < left.length; index += 1) dot += left[index] * right[index];
  return dot;
};

/** Indices of the `k` most similar vectors, most similar first. */
export const topK = (query: Vector, vectors: Vector[], k: number, exclude = -1): Array<{ index: number; score: number }> =>
  vectors
    .map((vector, index) => ({ index, score: index === exclude ? -Infinity : cosine(query, vector) }))
    .filter((match) => match.score !== -Infinity)
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .slice(0, Math.max(0, k));

/** Weighted concatenation of unit vectors, re-normalised (hybrid embeddings). */
export const concatenate = (parts: Array<{ vector: Vector; weight: number }>): Vector => {
  const length = parts.reduce((sum, part) => sum + part.vector.length, 0);
  const joined = new Float64Array(length);
  let offset = 0;
  for (const { vector, weight } of parts) {
    for (let index = 0; index < vector.length; index += 1) joined[offset + index] = vector[index] * Math.sqrt(weight);
    offset += vector.length;
  }
  return normalize(joined);
};
