import { computeSfs } from '@/services/siteFocus/aggregate';
import type { PageType } from '@/services/siteFocus/types';
import type { Vector } from '@/services/embeddings/types';
import { cosine } from '@/services/embeddings/vector';
import { chunkIssues, type ChunkIssue } from './chunks';
import { donorSuggestions, type DonorSuggestion } from './donors';
import type { DraftChunkReport } from './aioChunks';
import type { EvidenceGap, PrePublishGate, PrePublishPolicy } from './policy';

export const PREPUBLISH_PROFILE = { conflict: 0.88, overlap: 0.85, minTrs: 55, minPages: 3 } as const;

export interface CorpusPage { url: string; vector: Vector; trs: number; weight: number; type: PageType; intent?: string; links?: readonly string[] }
export interface Draft { url: string; vector: Vector; intent?: string; chunks: string[]; text?: string }

export type PrePublishVerdict = 'insufficient' | 'blocked' | 'review' | 'ok';

export interface PrePublishReport {
  verdict: PrePublishVerdict;
  /** Never true when evidence is insufficient; advisory only. */
  publishApproved: boolean;
  draftTrs: number | null;
  sfsBefore: number | null;
  sfsAfter: number | null;
  /** Signed: positive means the draft raises SFS. Not a traffic forecast. */
  sfsDelta: number | null;
  conflicts: Array<{ url: string; similarity: number; level: 'conflict' | 'overlap' }>;
  chunkIssues: ChunkIssue[];
  reasons: string[];
  /** Up to 3 internal link donors; empty when the check is inconclusive. */
  donors?: DonorSuggestion[];
  chunkDetails?: DraftChunkReport;
  policy?: PrePublishPolicy;
  gate?: PrePublishGate;
  evidenceGaps?: EvidenceGap[];
}

const round1 = (v: number) => Math.round(v * 10) / 10;

/** Draft TRS: cosine to the frozen Core vector, mapped to 0-100. */
export const draftTrs = (draft: Draft, core: Vector): number => round1(Math.max(0, cosine(draft.vector, core)) * 100);

/** Simulates the draft as a new or updated page of the corpus; the corpus array is never mutated. */
export const checkDraft = (draft: Draft, corpus: CorpusPage[], core: Vector | null): PrePublishReport => {
  const empty: PrePublishReport = { verdict: 'insufficient', publishApproved: false, draftTrs: null, sfsBefore: null, sfsAfter: null, sfsDelta: null, conflicts: [], chunkIssues: [], reasons: [] };
  const others = corpus.filter((page) => page.url !== draft.url);
  const dimension = core ? core.length : 0;
  if (!core || corpus.length < PREPUBLISH_PROFILE.minPages) return { ...empty, reasons: [core ? 'corpus-too-small' : 'no-core'] };
  if (draft.vector.length !== dimension || corpus.some((page) => page.vector.length !== dimension)) return { ...empty, reasons: ['dimension-mismatch'] };
  const trs = draftTrs(draft, core);
  const toScored = (page: CorpusPage) => ({ trs: page.trs, weight: page.weight, type: page.type, skipped: undefined });
  const before = computeSfs(corpus.map(toScored)).score;
  const after = computeSfs([...others.map(toScored), { trs, weight: 1, type: 'article' as PageType, skipped: undefined }]).score;
  const conflicts = others
    .filter((page) => !page.intent || !draft.intent || page.intent === draft.intent)
    .map((page) => ({ url: page.url, similarity: Math.round(cosine(draft.vector, page.vector) * 1000) / 1000 }))
    .filter((row) => row.similarity >= PREPUBLISH_PROFILE.overlap)
    .map((row) => ({ ...row, level: row.similarity >= PREPUBLISH_PROFILE.conflict ? 'conflict' as const : 'overlap' as const }))
    .sort((a, b) => b.similarity - a.similarity);
  const issues = chunkIssues(draft.chunks);
  const reasons: string[] = [];
  if (conflicts.some((c) => c.level === 'conflict')) reasons.push('cannibalization');
  else if (conflicts.length) reasons.push('overlap');
  if (trs < PREPUBLISH_PROFILE.minTrs) reasons.push('low-trs');
  if (issues.length) reasons.push('chunk-issues');
  const verdict: PrePublishVerdict = reasons.includes('cannibalization') ? 'blocked' : reasons.length ? 'review' : 'ok';
  const donors = donorSuggestions(draft, others);
  return { verdict, publishApproved: verdict === 'ok', draftTrs: trs, sfsBefore: before, sfsAfter: after, sfsDelta: round1(after - before), conflicts, chunkIssues: issues, reasons, donors };
};
