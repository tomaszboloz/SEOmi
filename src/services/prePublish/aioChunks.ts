import { AIO_WEAK_CHUNK, rulesFor, scoreChunk, type AioIssue } from '@/services/aioReadiness';
import { tokenCount } from '@/services/aioReadiness/text';

/** One draft passage scored with the shared AIO-R engine (#94 GEM-94-06); offsets point into the draft text. */
export interface DraftChunkDetail {
  index: number;
  heading: string;
  start: number;
  end: number;
  excerpt: string;
  score: number;
  answerFirst: number | null;
  selfContainment: number;
  triples: number;
  issues: AioIssue[];
  weak: boolean;
}
export interface DraftChunkReport { language: string; languageStatus: 'supported' | 'uncertain' | 'unsupported'; chunks: DraftChunkDetail[] }

const EXCERPT = 160;

/** Blank-line separated passages; a single "# Heading" line becomes the heading of the next passage. */
export const draftChunkDetails = (text: string, language: string): DraftChunkReport => {
  const { language: resolved, rules, status } = rulesFor(language || 'und');
  const chunks: DraftChunkDetail[] = [];
  let heading = '';
  for (const match of text.matchAll(/[^\n]+(?:\n(?!\s*\n)[^\n]*)*/gu)) {
    const raw = match[0];
    const trimmed = raw.trim();
    if (!trimmed) continue;
    const start = match.index + raw.indexOf(trimmed);
    if (/^#{1,6}\s+\S/u.test(trimmed) && !trimmed.includes('\n')) { heading = trimmed.replace(/^#+\s*/u, ''); continue; }
    const scored = scoreChunk({
      heading, level: heading ? 2 : 0, paragraphs: [trimmed], tokens: tokenCount(trimmed, rules.charBased), windowIndex: 0,
      offsets: { start, end: start + trimmed.length, unit: 'utf16' },
    }, rules);
    chunks.push({
      index: chunks.length, heading, start, end: start + trimmed.length,
      excerpt: trimmed.length > EXCERPT ? `${trimmed.slice(0, EXCERPT - 1)}…` : trimmed,
      score: scored.score, answerFirst: scored.answerFirstAvailability === 'available' ? scored.answerFirst : null,
      selfContainment: scored.selfContainment, triples: scored.triples, issues: scored.issues,
      weak: scored.score < AIO_WEAK_CHUNK || scored.issues.length > 0,
    });
    heading = '';
  }
  return { language: resolved, languageStatus: status, chunks };
};
