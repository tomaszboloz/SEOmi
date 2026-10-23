export interface SourceParagraph { sourceUrl: string; offset: number; text: string; linked: boolean }

export interface CoCitation {
  sourceUrl: string;
  offset: number;
  linked: boolean;
  /** 'unclear' when a negation cue sits near the brand; never counted as support. */
  polarity: 'neutral' | 'unclear';
  excerpt: string;
}

export interface CoCitationReport {
  linked: CoCitation[];
  unlinked: CoCitation[];
  /** Paragraphs inspected; zero means no source text was available. */
  inspected: number;
  note: 'ready' | 'no-source-text';
}

const NEGATION = /\b(?:not|never|no|without|nie|nigdy|kein|keine|nicht|pas|jamais|nunca|sin|non|mai|não|без|не)\b|不|没有|ない|않/iu;
const EXCERPT = 160;

const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Whole-word, case-insensitive test, so a brand alias inside a longer word is not a hit. */
const hasTerm = (text: string, term: string): boolean =>
  new RegExp(`(?<![\\p{L}\\p{N}])${escape(term.trim())}(?![\\p{L}\\p{N}])`, 'iu').test(text);

/** Brand (any alias) and core entity in the same real paragraph. Co-occurrence is not endorsement. */
export const findCoCitations = (paragraphs: SourceParagraph[], brandAliases: string[], coreEntity: string): CoCitationReport => {
  const aliases = brandAliases.filter((a) => a.trim());
  const report: CoCitationReport = { linked: [], unlinked: [], inspected: paragraphs.length, note: paragraphs.length ? 'ready' : 'no-source-text' };
  if (!aliases.length || !coreEntity.trim()) return report;
  paragraphs.forEach((p) => {
    if (!hasTerm(p.text, coreEntity) || !aliases.some((a) => hasTerm(p.text, a))) return;
    const hit: CoCitation = { sourceUrl: p.sourceUrl, offset: p.offset, linked: p.linked, polarity: NEGATION.test(p.text) ? 'unclear' : 'neutral', excerpt: p.text.trim().slice(0, EXCERPT) };
    (p.linked ? report.linked : report.unlinked).push(hit);
  });
  return report;
};
