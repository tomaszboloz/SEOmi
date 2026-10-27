import type { IgosReport } from '@/services/igos/report';

interface SourceFields {
  title: string;
  url: string;
  summary: string;
}

export interface IgosSourceEvidence {
  reportId: string;
  sourceUrl: string;
  novelEntities: string[];
  gainZones: number;
  baselineDocs: number;
  baselineProvenance: 'igos';
}

export interface UniqueSource extends SourceFields {
  /** Only an IGOS-verified source may be attached to an outreach draft. */
  provenance: 'igos';
  evidence: IgosSourceEvidence;
}

export interface IgosSourceCandidate extends SourceFields {
  provenance?: 'igos';
  evidence?: IgosSourceEvidence;
}

export type IgosSourceStatus = 'ready' | 'partial' | 'unavailable';

export const isHttpSourceUrl = (value: string): boolean => {
  try {
    const url = new URL(value.trim());
    return (url.protocol === 'https:' || url.protocol === 'http:') && !url.username && !url.password;
  } catch {
    return false;
  }
};

export const igosSourceStatus = (report: Pick<IgosReport, 'status' | 'igos'> | null): IgosSourceStatus => {
  if (!report || report.igos === null || report.status === 'unavailable' || report.status === 'off-topic') return 'unavailable';
  return report.status === 'partial' ? 'partial' : 'ready';
};

/**
 * Attach only a real source supplied by the verified IGOS workflow with concrete novelty evidence.
 * Missing evidence, invalid URLs, or empty novel entities stay unavailable.
 */
export const resolveIgosSource = (
  report: Pick<IgosReport, 'status' | 'igos'> | null,
  candidate: IgosSourceCandidate | null,
): UniqueSource | null => {
  if (igosSourceStatus(report) === 'unavailable' || !candidate) return null;
  const title = candidate.title.trim();
  const url = candidate.url.trim();
  const summary = candidate.summary.trim();
  if (!title || !summary || !isHttpSourceUrl(url) || candidate.provenance !== 'igos') return null;
  const evidence = candidate.evidence;
  if (!evidence || evidence.baselineProvenance !== 'igos' || evidence.sourceUrl !== url) return null;
  if (!evidence.reportId || !Array.isArray(evidence.novelEntities) || evidence.novelEntities.length === 0) return null;
  return { title, url, summary, provenance: 'igos', evidence };
};
