import type { ModelProvenance, OcrArtifact, TranscriptArtifact } from './modelProviders';

/**
 * Text facts recovered from media (#96 GEM-96-05/07, T04). OCR boxes and transcript segments are joined
 * with the page HTML: a fact already present in the HTML is marked `duplicate-of-html` so TAS/IGOS/AIO do
 * not count it twice; only genuinely new media text is `media-only`. Low or unknown confidence stays
 * `partial` and is never promoted to a verified fact. Every fact keeps its provenance and locator.
 */
export const MIN_FACT_CONFIDENCE = 0.8;
const MIN_FACT_CHARS = 12;

export type FactOrigin = 'duplicate-of-html' | 'media-only';

export interface MediaFact {
  text: string;
  origin: FactOrigin;
  quality: 'confident' | 'partial';
  locator: { kind: 'bbox'; bbox: [number, number, number, number] } | { kind: 'timecode'; startMs: number; endMs: number };
  provenance: ModelProvenance;
}

/** Unicode-aware normalization so RTL/CJK text and different spacing/case compare equal. */
export const normalizeFactText = (text: string): string =>
  text.normalize('NFKC').toLocaleLowerCase().replace(/[^\p{L}\p{N}%]+/gu, ' ').trim();

const quality = (provenance: ModelProvenance): MediaFact['quality'] =>
  provenance.confidence !== null && Number.isFinite(provenance.confidence) && provenance.confidence >= MIN_FACT_CONFIDENCE ? 'confident' : 'partial';

const validBox = (bbox: [number, number, number, number]): boolean =>
  bbox.every(Number.isFinite) && bbox[2] > 0 && bbox[3] > 0 && bbox[0] >= 0 && bbox[1] >= 0;

export interface MediaFactReport {
  facts: MediaFact[];
  /** Items skipped as too short, invalid locator or repeated media text. */
  skipped: number;
}

export const mergeMediaFacts = (html: string, ocr: OcrArtifact[], transcripts: TranscriptArtifact[]): MediaFactReport => {
  const page = ` ${normalizeFactText(html)} `;
  const seen = new Set<string>();
  const facts: MediaFact[] = [];
  let skipped = 0;
  const add = (text: string, locator: MediaFact['locator'], provenance: ModelProvenance) => {
    const key = normalizeFactText(text);
    if (key.length < MIN_FACT_CHARS || seen.has(key)) { skipped += 1; return; }
    seen.add(key);
    facts.push({ text: text.trim(), origin: page.includes(` ${key} `) ? 'duplicate-of-html' : 'media-only', quality: quality(provenance), locator, provenance });
  };
  ocr.forEach((box) => {
    if (!validBox(box.bbox)) { skipped += 1; return; }
    add(box.text, { kind: 'bbox', bbox: box.bbox }, box.provenance);
  });
  transcripts.forEach((transcript) => transcript.segments.forEach((segment) => {
    if (!Number.isFinite(segment.startMs) || !(segment.endMs > segment.startMs)) { skipped += 1; return; }
    add(segment.text, { kind: 'timecode', startMs: segment.startMs, endMs: segment.endMs }, transcript.provenance);
  }));
  return { facts, skipped };
};
