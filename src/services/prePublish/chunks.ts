export type ChunkIssueKind = 'leading-pronoun' | 'too-short';
export interface ChunkIssue { index: number; kind: ChunkIssueKind }

export const MIN_CHUNK_WORDS = 20;

/** Chunk openers that depend on earlier context and break when a passage is retrieved alone. */
const PRONOUN_START = /^(?:it|this|that|these|those|they|he|she|ten|ta|to|te|oni|on|ona|es|das|dies|sie|er|ce|cela|ils|elle|este|esta|eso|ellos|questo|quello|loro|isto|esse|eles|это|он|она|они|それ|この|그것|이것|这|它|ذلك|هذا)(?![\p{L}])/iu;

/** Flags passages that cannot stand alone for retrieval. Lists the chunk index, never rewrites text. */
export const chunkIssues = (chunks: string[]): ChunkIssue[] =>
  chunks.flatMap((text, index): ChunkIssue[] => {
    const trimmed = text.trim();
    const issues: ChunkIssue[] = [];
    if (PRONOUN_START.test(trimmed)) issues.push({ index, kind: 'leading-pronoun' });
    if ((trimmed.match(/[\p{L}\p{N}]+/gu) ?? []).length < MIN_CHUNK_WORDS) issues.push({ index, kind: 'too-short' });
    return issues;
  });
