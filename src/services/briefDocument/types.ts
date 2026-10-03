import type { TopicalContentBrief, TopicalEntityFact, TopicalNode } from '@/services/topicalMap';

export interface ContentBriefAssessment {
  targetQuery: string | null;
  missingRequiredEntities: string[];
  lockedFactsInDraft: TopicalEntityFact[];
  unavailableInternalLinks: string[];
  unreviewedParagraphs: string[];
  unsupportedParagraphs: string[];
  wordCount: number;
  paragraphCount: number;
  draftQuality: DraftQualityAssessment;
  aeoReadiness: AeoReadinessAssessment;
  readyForBrief: boolean;
  readyToAdvance: boolean;
}

export interface DraftQualityAssessment {
  score: number;
  grade: 'excellent' | 'good' | 'needs-work' | 'thin';
  components: { depth: number; examples: number; specificity: number; antiFiller: number; length: number };
  wordCount: number;
  sectionCount: number;
  medianWordsPerSection: number;
  fillerMatches: string[];
  recommendations: string[];
  methodology: string;
}

export interface AeoReadinessAssessment {
  score: number;
  components: { definition: number; questionAnswers: number; summary: number; structure: number; brevity: number; standalone: number; schemaSignal: number };
  questionHeadings: number;
  answeredQuestionHeadings: number;
  schemaTypesObserved: string[];
  outlineIssues: string[];
  recommendations: string[];
  methodology: string;
}
export interface ParagraphSourceEvidence {
  matched: boolean;
  scope: 'sentence-match' | 'excerpt' | 'semantic-terms' | 'title' | 'no-signal' | 'not-in-snapshot';
  matchedTerms: string[];
  overlapPercent: number | null;
  matchedExcerpt?: string;
  matchedSentence?: string;
  sentenceOverlapPercent?: number | null;
  responseSpan?: { start: number; end: number };
  sourceSpan?: { start: number; end: number };
  pageUrl?: string;
}
export interface DraftDiff {
  changed: boolean;
  addedLineCount: number;
  removedLineCount: number;
  addedLines: string[];
  removedLines: string[];
  addedCharacterCount: number;
  removedCharacterCount: number;
}
export interface ContentBriefExportPayload {
  schemaVersion: 1;
  exportedAt: string;
  node: { id: string; title: string; lifecycle: TopicalNode['lifecycle'] };
  brief: TopicalContentBrief;
}
