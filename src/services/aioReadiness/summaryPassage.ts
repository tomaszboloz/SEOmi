import type { AioChunk, AioIssue } from './types';

const EXCERPT_CHARS = 220;
export const AIO_PDF_FACTS = 3;

/** One weak passage in the PDF digest, with the chunk-inspector evidence (#64 GEM-64-08). */
export interface AioPdfPassage {
  url: string;
  heading: string;
  score: number;
  excerpt: string;
  issues: AioIssue[];
  /** 0-100; null when the engine did not report the component (older data). */
  self_containment: number | null;
  spo_density: number | null;
  /** null when Answer-First does not apply to this window or is unknown. */
  answer_first: number | null;
  answer_first_applicable: boolean;
  /** UTF-16 offsets in the section text; null when unknown. */
  offset_start: number | null;
  offset_end: number | null;
  facts: Array<{ subject: string; predicate: string; object: string; negated: boolean }>;
}

const percent = (ratio: number | undefined): number | null =>
  typeof ratio === 'number' && Number.isFinite(ratio) ? Math.round(Math.max(0, Math.min(1, ratio)) * 100) : null;

const validOffsets = (offsets: AioChunk['offsets']): offsets is NonNullable<AioChunk['offsets']> =>
  !!offsets && Number.isInteger(offsets.start) && Number.isInteger(offsets.end) && offsets.start >= 0 && offsets.end >= offsets.start;

export const pdfPassage = (chunk: AioChunk & { url: string }): AioPdfPassage => {
  const applicable = chunk.answerFirstAvailability !== 'not-applicable';
  const offsets = validOffsets(chunk.offsets) ? chunk.offsets : undefined;
  return {
    url: chunk.url,
    heading: chunk.heading,
    score: chunk.score,
    excerpt: chunk.text.length > EXCERPT_CHARS ? `${chunk.text.slice(0, EXCERPT_CHARS)}…` : chunk.text,
    issues: chunk.issues,
    self_containment: percent(chunk.selfContainment),
    spo_density: percent(chunk.spoDensity),
    answer_first: applicable ? percent(chunk.answerFirst) : null,
    answer_first_applicable: applicable,
    offset_start: offsets?.start ?? null,
    offset_end: offsets?.end ?? null,
    facts: (chunk.spoTriples ?? []).slice(0, AIO_PDF_FACTS).map((fact) => ({
      subject: fact.subject, predicate: fact.predicate, object: fact.object, negated: !!fact.negated,
    })),
  };
};
