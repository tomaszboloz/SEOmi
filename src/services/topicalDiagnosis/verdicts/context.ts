import type { DiagnosisArea, DiagnosisDocument, DiagnosisTopic, DiagnosisVerdict, VerdictCode, VerdictEvidence, VerdictSeverity } from '../types';
import type { DocumentLinkIndex } from '../links';
import type { TopicPair } from '../topics';
import type { TermStatistics } from '../similarity';

export interface VerdictContext {
  documents: DiagnosisDocument[];
  byId: Map<string, DiagnosisDocument>;
  /** Main-content links. */
  links: DocumentLinkIndex;
  /** False when no page of the run carries main-content links; link verdicts then have no evidence. */
  contentLinks: boolean;
  /** Every captured link, navigation and breadcrumbs included. */
  allLinks: DocumentLinkIndex;
  areas: DiagnosisArea[];
  areaByDocument: Map<string, string>;
  topics: DiagnosisTopic[];
  topicByDocument: Map<string, string>;
  pairs: TopicPair[];
  stats: TermStatistics;
  startUrl: string;
  /** Distinct languages across all documents. */
  languages: string[];
}

export const urlOf = (document: DiagnosisDocument): string => document.primaryPage.url;

export const documentIndex = (id: string): number => Number(id.slice(4));

export const contentDocuments = (context: VerdictContext): DiagnosisDocument[] =>
  context.documents.filter((document) => document.role === 'content');

export const verdict = (
  code: VerdictCode, severity: VerdictSeverity, scope: DiagnosisVerdict['scope'], scopeId: string,
  involved: DiagnosisDocument[], evidence: VerdictEvidence[] = [], urls = involved.map(urlOf),
): DiagnosisVerdict => ({
  id: `${code}:${scopeId}`,
  code,
  severity,
  scope,
  scopeId,
  urls,
  evidence,
  confidence: involved.some((document) => document.partialEvidence) ? 'limited' : 'moderate',
});

const SEVERITY_ORDER: Record<VerdictSeverity, number> = { fix: 0, weak: 1, info: 2, good: 3 };

export const sortVerdicts = (verdicts: DiagnosisVerdict[]): DiagnosisVerdict[] => [...verdicts].sort((a, b) =>
  SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] || a.code.localeCompare(b.code) || a.scopeId.localeCompare(b.scopeId));
