
export type TopicalNodeKind = 'pillar' | 'cluster' | 'supporting';
export type TopicalBoundary = 'core' | 'outer';
export type TopicalLifecycle = 'planned' | 'briefed' | 'drafted' | 'published' | 'needs-update';
export type SearchIntent = 'informational' | 'commercial' | 'transactional' | 'navigational' | 'mixed' | 'unknown';

export interface TopicalEntityFact {
  id: string;
  attribute: string;
  value: string;
  sourceUrl: string;
  reuseStatus: 'locked' | 'verified';
}

export type SnippetTarget = 'none' | 'definition' | 'list' | 'table' | 'steps' | 'faq';

export interface ContentParagraphReview {
  paragraph: string;
  treatment: 'unreviewed' | 'editorial' | 'source-backed';
  sourceUrl: string;
  sourceChecked: boolean;
}

/** A bounded, user-created checkpoint of the editorial draft. */
export interface ContentBriefVersion {
  id: string;
  savedAt: string;
  note: string;
  draftMarkdown: string;
}

export interface DataForSeoTopicalEvidence {
  provider: 'DataForSEO Google Ads Keywords for Keywords Live';
  retrievedAt: string;
  seedKeyword: string;
  countryCode: string;
  locationCode: number;
  languageCode: string;
  searchVolume: number | null;
  cpc: number | null;
  competitionIndex: number | null;
  searchIntent: string | null;
  monthlySearches: Array<{ year: number | null; month: number | null; searchVolume: number | null }>;
}

export interface GscTopicalEvidence {
  provider: 'Google Search Console';
  retrievedAt: string;
  propertyUrl: string;
  startDate: string;
  endDate: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  queryRowsMayBeTruncated: boolean;
  maxRowsPerDimension: number;
}

export type TopicalQueryEvidence = DataForSeoTopicalEvidence | GscTopicalEvidence;

export interface TopicalContentBrief {
  targetQueryId: string;
  requiredEntities: string[];
  snippetTarget: SnippetTarget;
  internalLinkTargets: string[];
  draftMarkdown: string;
  paragraphReviews: ContentParagraphReview[];
  draftVersions: ContentBriefVersion[];
}

export interface TopicalQuery {
  id: string;
  text: string;
  provenance: 'asserted' | 'dataforseo' | 'gsc';
  source?: TopicalQueryEvidence;
}

export interface TopicalNode {
  id: string;
  title: string;
  kind: TopicalNodeKind;
  boundary: TopicalBoundary;
  parentId: string | null;
  relatedNodeIds: string[];
  intent: SearchIntent;
  lifecycle: TopicalLifecycle;
  scheduledDate: string;
  queries: TopicalQuery[];
  facts: TopicalEntityFact[];
  evidenceTerms: string[];
  sourceUrls: string[];
  sourceRunId: string | null;
  sourceClusterId: string | null;
  contentBrief: TopicalContentBrief;
}

export interface TopicalMapDocument {
  schemaVersion: 1;
  entity: { name: string; description: string; facts: TopicalEntityFact[] };
  nodes: TopicalNode[];
  updatedAt: string;
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}
