/**
 * Parse-once cache identity (#85 GEM-85-04, #86 GEM-86-07): an artifact (tokens, embeddings) is reused only
 * when content, model, language, market and profile all match, inside one project. Changing any part
 * invalidates the entry; nothing is shared across projects.
 */
export interface ArtifactKeyInput {
  projectId: string;
  /** Kind of artifact, e.g. `embedding` or `terms`. */
  kind: string;
  content: string;
  modelId: string | null;
  language: string | null;
  market: string | null;
  profileId: string | null;
  algorithmVersion: number;
}

/** 64-bit FNV-1a over UTF-16 code units, as 16 hex chars; deterministic and dependency-free. */
export const contentHash = (text: string): string => {
  let hash = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  const mask = 0xffffffffffffffffn;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= BigInt(text.charCodeAt(index));
    hash = (hash * prime) & mask;
  }
  return hash.toString(16).padStart(16, '0');
};

const part = (value: string | null): string => (value === null ? '∅' : value.trim().toLowerCase());

export const artifactKey = (input: ArtifactKeyInput): string => {
  if (!input.projectId.trim()) throw new Error('Project ID is required for an analysis artifact key');
  return [
    input.projectId.trim(), part(input.kind), contentHash(input.content), part(input.modelId), part(input.language),
    part(input.market), part(input.profileId), String(input.algorithmVersion),
  ].join('\u0000');
};
