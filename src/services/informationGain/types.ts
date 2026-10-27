import type { ContentSection, CrawledPageSummary } from '@/types';

/** Engine output is codes plus params; the UI and the PDF localize them. */
export type CodeParams = Record<string, number | string>;
export interface Coded { code: string; params: CodeParams }

export type InfoGainPage = CrawledPageSummary & { content_sections?: ContentSection[] };
export type SectionZone = 'echo' | 'gain' | 'drift';
export type IgosBand = 'original' | 'good' | 'average' | 'derivative' | 'echo';
export type SkipReason = 'no-sections' | 'not-html' | 'status';

/** Competitor page used as a SERP consensus document. */
export interface BaselineDoc { url: string; rank?: number; sections: ContentSection[] }

export interface Thresholds {
  /** A paragraph this close to a competitor paragraph is Echo. */
  echo: number;
  /** A paragraph below this closeness to the SERP topic is Semantic Drift. */
  topic: number;
}

/**
 * Lexical (TF-IDF) cosines run far lower than embedding cosines, so the lexical gates are lower than the
 * 0.82 / 0.48 meant for embeddings. Calibration assumption: verify on real crawls.
 */
export const LEXICAL_THRESHOLDS: Thresholds = { echo: 0.55, topic: 0.05 };
export const WEIGHTS = { nefr: 0.35, edsi: 0.3, fhem: 0.2, sdd: 0.15 } as const;
export const CONSENSUS_DF = 0.4;
export const MIN_BASELINE_DOCS = 2;
export const THIN_BASELINE_DOCS = 5;
export const MAX_EVALUATED_PAGES = 150;

export interface SectionAudit {
  heading: string;
  level: number;
  zone: SectionZone;
  /** 0-100. */
  novelty: number;
  maxSerpSimilarity: number;
  topicRelevance: number;
  closestUrl: string;
  novelEntities: string[];
  facts: number;
  firstHand: boolean;
}

export interface IgosParts { nefr: number; edsi: number; sdd: number; fhem: number | null }

export interface PageIgos {
  url: string;
  /** 0-100. */
  score: number;
  band: IgosBand;
  /** Component scores, 0-100; `fhem` is null for languages without markers. */
  parts: IgosParts;
  /** Percent of consensus entities present, and the 0.5-1.0 foundation multiplier. */
  baseCoverage: number;
  foundationMultiplier: number;
  /** Percent of sections per zone. */
  zones: Record<SectionZone, number>;
  novelEntities: string[];
  missingConsensus: string[];
  experiencePhrases: string[];
  sections: SectionAudit[];
  recommendations: Coded[];
  language: string;
  skipped?: SkipReason;
}

export interface BaselineMeta { docs: number; urls: string[]; consensusEntities: number; thin: boolean; queries: string[]; source: string }

export interface SiteIgos {
  score: number;
  band: IgosBand;
  parts: IgosParts;
  zones: Record<SectionZone, number>;
  pages: PageIgos[];
  evaluated: number;
  skipped: number;
  /** Pages cut by MAX_EVALUATED_PAGES. */
  truncated: number;
  fhemUnavailablePages: number;
  baseline: BaselineMeta;
  recommendations: Coded[];
  generatedAt: string;
}

export const IGOS_CODES = {
  band: ['original', 'good', 'average', 'derivative', 'echo'],
  recommendation: ['rewrite-echo-sections', 'add-first-hand', 'add-data', 'add-novel-entities', 'fill-consensus', 'remove-drift-sections', 'collect-baseline'],
} as const;
