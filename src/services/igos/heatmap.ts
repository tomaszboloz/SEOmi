import type { IgosReport } from './report';
import type { ChunkZone } from './types';

export interface HeatmapCell {
  offset: number;
  zone: ChunkZone;
  /** Text label so colour is never the only signal. */
  label: ChunkZone;
  topic: number;
  nearest: number;
  excerpt: string;
  /** Reference to the nearest competitor passage; its text is intentionally not copied. */
  source: { url: string; rank: number; passageIndex: number } | null;
}

export interface HeatmapSection { heading: string | null; cells: HeatmapCell[] }

export type RecommendationKind = 'rewrite-echo' | 'add-evidence' | 'refocus-drift';

export interface HeatmapRecommendation { kind: RecommendationKind; offset: number; source: HeatmapCell['source'] }

const EXCERPT = 140;

/** Groups zoned chunks by heading (H2 -> paragraph) for keyboard navigation. */
export const buildHeatmap = (report: IgosReport): HeatmapSection[] => {
  const sections: HeatmapSection[] = [];
  report.zones.forEach((zone) => {
    const heading = zone.chunk.heading;
    let section = sections[sections.length - 1];
    if (!section || section.heading !== heading) { section = { heading, cells: [] }; sections.push(section); }
    section.cells.push({ offset: zone.chunk.offset, zone: zone.zone, label: zone.zone, topic: zone.topic, nearest: zone.nearest, excerpt: zone.chunk.text.slice(0, EXCERPT), source: zone.evidence });
  });
  return sections;
};

/** Advice refers to competitor source rows only; it never reproduces competitor text. */
export const recommend = (sections: HeatmapSection[]): HeatmapRecommendation[] =>
  sections.flatMap((section) => section.cells.flatMap((cell): HeatmapRecommendation[] => {
    if (cell.zone === 'echo') return [{ kind: 'rewrite-echo', offset: cell.offset, source: cell.source }];
    if (cell.zone === 'drift') return [{ kind: 'refocus-drift', offset: cell.offset, source: cell.source }];
    return [];
  }));

export const evidenceAdvice = (report: IgosReport): HeatmapRecommendation[] =>
  report.components && report.components.edsi === 0 ? [{ kind: 'add-evidence', offset: 0, source: null }] : [];
