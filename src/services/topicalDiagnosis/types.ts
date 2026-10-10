import type { CrawledPageSummary } from '@/types';

export type DocumentRole = 'hub' | 'utility' | 'content';

/** One crawled document: a page with its reciprocal hreflang versions and pagination pages folded in. */
export interface DiagnosisDocument {
  /** `doc-<index of the primary page in the filtered page list>`. */
  id: string;
  pages: CrawledPageSummary[];
  /** The page in the start URL's language, otherwise the first page of the group. */
  primaryPage: CrawledPageSummary;
  /** Normalized `url` and `final_url` of every page. */
  urls: Set<string>;
  /** Sorted distinct semantic languages of the pages. */
  languages: string[];
  /** Union of language-namespaced semantic term keys. */
  terms: Set<string>;
  /** Language-namespaced keys of the title tokens. */
  titleTerms: Set<string>;
  /** Title token key to its display form (lowercase, original letters). */
  titleForms: Map<string, string>;
  /** First path segment without the language prefix; `(root)` for the start page. */
  section: string;
  role: DocumentRole;
  /** `body_truncated` or `semantic_content_partial` on any page. */
  partialEvidence: boolean;
}

export interface DiagnosisArea {
  id: string;
  /** `null` for the synthetic area of documents no hub links to. */
  hubId: string | null;
  label: string;
  documentIds: string[];
}

export interface DiagnosisTopic {
  id: string;
  label: string;
  labelSource: 'title' | 'content' | 'none';
  documentIds: string[];
  areaIds: string[];
}

export type VerdictSeverity = 'good' | 'info' | 'weak' | 'fix';

export type VerdictCode =
  | 'hub-missing-backlink' | 'hub-missing-member-link' | 'area-healthy'
  | 'topic-no-hub' | 'topic-members-unlinked' | 'topic-thin' | 'cannibalization-candidate'
  | 'document-isolated' | 'document-orphan' | 'near-duplicate' | 'language-pair-missing';

export interface VerdictEvidence {
  key: string;
  params?: Record<string, string | number>;
}

export interface DiagnosisVerdict {
  id: string;
  code: VerdictCode;
  severity: VerdictSeverity;
  scope: 'area' | 'topic' | 'document';
  scopeId: string;
  urls: string[];
  evidence: VerdictEvidence[];
  confidence: 'limited' | 'moderate';
}

export interface DiagnosisStats {
  pages: number;
  skippedPages: number;
  documents: number;
  hubs: number;
  utilities: number;
  topics: number;
  singletons: number;
  languages: string[];
  mergedPairs: number;
}

export interface TopicalDiagnosisReport {
  documents: DiagnosisDocument[];
  areas: DiagnosisArea[];
  topics: DiagnosisTopic[];
  verdicts: DiagnosisVerdict[];
  stats: DiagnosisStats;
  noTerms: boolean;
  truncated: boolean;
}

/** Similarity in [0, 1] between two documents; the default is an IDF-weighted Jaccard over topical terms. */
export type SimilarityFn = (left: DiagnosisDocument, right: DiagnosisDocument) => number;

export interface TopicalDiagnosisOptions {
  similarity?: SimilarityFn;
}
