import type { IgosReport } from '@/services/igos/report';
import type { UniqueSource } from './draft';

/** A source is scoped to the project that produced its IGOS evidence. */
export interface InformationGainInput {
  projectId: string;
  site: string;
  report: IgosReport | null;
  source: UniqueSource | null;
  provenance?: InformationGainProvenance;
}

export interface InformationGainProvenance {
  provider: string;
  model: string;
  approximation: string;
  observedAt: string | null;
}

export interface InformationGainSource extends UniqueSource {
  evidenceUrl: string;
  score: number;
  novelEntities: string[];
  provenance: InformationGainProvenance;
}

const url = (value: string): string | null => {
  const trimmed = value.trim();
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? trimmed : null;
  } catch {
    return null;
  }
};

/**
 * Converts a real IGOS result into an outreach source. Partial, unavailable,
 * off-topic, or source-less reports intentionally produce no draft material.
 */
export const informationGainSource = (input: InformationGainInput | null): InformationGainSource | null => {
  const report = input?.report;
  const source = input?.source;
  if (!input?.projectId.trim() || !url(input.site) || !source || !report || report.status !== 'ready' || report.igos === null) return null;
  if (!report.novelEntities.length || !source.title.trim() || !source.summary.trim()) return null;
  const evidence = report.zones.find((zone) => zone.zone === 'gain' && zone.evidence?.url)?.evidence;
  const sourceUrl = url(source.url);
  const evidenceUrl = evidence ? url(evidence.url) : null;
  if (!sourceUrl || !evidenceUrl) return null;
  const provenance = input.provenance ?? { provider: 'unavailable', model: 'unavailable', approximation: 'unavailable', observedAt: null };
  return {
    title: source.title.trim(),
    url: sourceUrl,
    summary: source.summary.trim(),
    evidenceUrl,
    score: report.igos,
    novelEntities: [...report.novelEntities],
    provenance: { ...provenance },
  };
};
