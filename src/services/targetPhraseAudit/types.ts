import type { DataForSEOSerpItem, PageAuditData } from '@/types';

export type TargetPhraseIntent = 'informational' | 'commercial' | 'transactional' | 'navigational';
export type PhraseEvidenceField = 'title' | 'h1' | 'body' | 'anchors';

export interface PhraseFieldEvidence {
  field: PhraseEvidenceField;
  occurrences: number;
  evidence: string[];
}

export interface TargetPhraseAudit {
  phrase: string;
  url: string;
  timestamp: string;
  intent: TargetPhraseIntent | null;
  intentSource: 'provider' | 'unavailable';
  completeness: 'complete' | 'partial';
  completenessReasons: string[];
  evidence: PhraseFieldEvidence[];
}

export interface TopTenSerpRow extends Partial<DataForSEOSerpItem> {
  /** Tests/importers may supply an already-normalized rank. */
  rank?: number;
}

export type PageAvailability = 'available' | 'unavailable' | 'error';

export interface TopTenPageObservation {
  rank: number;
  url: string;
  providerTitle: string;
  providerDescription: string;
  fetchedAt: string | null;
  status: number | null;
  finalUrl: string | null;
  availability: PageAvailability;
  error: string | null;
}

export interface SuppliedTopTenEvidence {
  url: string;
  fetchedAt: string | null;
  audit?: PageAuditData;
  error?: unknown;
}

export interface SuppliedTargetEvidence {
  url: string;
  fetchedAt: string | null;
  audit?: PageAuditData;
  error?: unknown;
}

export interface ContentGapTopicEvidence {
  rank: number;
  url: string;
  excerpt: string;
}

export interface ContentGapTopic {
  term: string;
  observedPages: number;
  availablePages: number;
  share: number;
  targetOccurrences: number | null;
  targetPresent: boolean | null;
  status: 'gap' | 'covered' | 'unknown';
  evidence: ContentGapTopicEvidence[];
}

export interface TopTenContentGapReport {
  phrase: string;
  source: 'supplied-serp';
  retrievedAt: string;
  locationCode: number | null;
  languageCode: string | null;
  rows: TopTenPageObservation[];
  availablePages: number;
  targetAvailable: boolean;
  status: 'complete' | 'partial' | 'unavailable';
  topics: ContentGapTopic[];
}

export type InspectPage = (url: string) => Promise<PageAuditData>;
