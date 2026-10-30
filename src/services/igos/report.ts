import { baseCoverage, edsi, fhem, nefr, novelEntities, penalty, sdd } from './components';
import { IGOS_PROFILE as P } from './profile';
import type { Availability, CompetitorDoc, ConsensusBaseline, TargetDoc, ZonedChunk } from './types';
import { zoneChunks } from './zones';

/** Who produced the vectors and when; one identity per run (GEM-68-01). */
export interface IgosProvenance {
  provider: string;
  model: string;
  runAt: string;
  targetUrl: string;
  docs: Array<{ url: string; rank: number; fetchedAt: string | null }>;
}

export interface IgosReport {
  status: Availability | 'off-topic';
  /** null whenever the score would be fabricated: no baseline or off-topic page. */
  igos: number | null;
  components: { nefr: number; edsi: number; fhem: number; sdd: number } | null;
  coverage: number | null;
  multiplier: number | null;
  onTopicShare: number | null;
  availableDocs: number;
  requestedDocs: number;
  novelEntities: string[];
  zones: ZonedChunk[];
  limitations: string[];
  provenance?: IgosProvenance;
}

export const buildIgosReport = (target: TargetDoc, docs: CompetitorDoc[], baseline: ConsensusBaseline): IgosReport => {
  const empty: IgosReport = { status: baseline.status, igos: null, components: null, coverage: null, multiplier: null, onTopicShare: null, availableDocs: baseline.availableDocs, requestedDocs: baseline.requestedDocs, novelEntities: [], zones: [], limitations: [...baseline.limitations] };
  if (baseline.status === 'unavailable' || !target.chunks.length) {
    if (!target.chunks.length) empty.limitations.push('no-target-chunks');
    return { ...empty, status: 'unavailable' };
  }
  const zones = zoneChunks(target.chunks, baseline, docs);
  const onTopic = zones.filter((zone) => zone.topic >= P.gainTopic).length / zones.length;
  const onTopicText = zones.filter((zone) => zone.topic >= P.gainTopic).map((zone) => zone.chunk.text).join('\n');
  const novel = novelEntities(target.entities, baseline, onTopicText);
  const text = target.chunks.map((chunk) => chunk.text).join('\n');
  const components = { nefr: nefr(novel.length, baseline.consensusEntities.length), edsi: edsi(text, target.wordCount), fhem: fhem(text), sdd: sdd(target.terms, baseline.terms) };
  const coverage = baseCoverage(target, baseline);
  const multiplier = penalty(coverage);
  const base = { ...empty, zones, novelEntities: novel, components, coverage, multiplier, onTopicShare: onTopic };
  if (onTopic < P.onTopicQuota) return { ...base, status: 'off-topic', limitations: [...empty.limitations, 'off-topic-below-quota'] };
  const raw = P.weights.nefr * components.nefr + P.weights.edsi * components.edsi + P.weights.fhem * components.fhem + P.weights.sdd * components.sdd;
  return { ...base, igos: Math.round(100 * raw * multiplier) };
};
