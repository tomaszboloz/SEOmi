import type { MapNode } from './mapTypes';

const STATUS_COLORS = { '2xx': '#34d399', '3xx': '#fbbf24', '4xx': '#fb7185', '5xx': '#ef4444', other: '#94a3b8' } as const;

/** TRS bands follow Site Focus: <40 off-topic, <60 weak, <75 fair, else on-topic. */
export const TRS_BANDS = [
  { min: 75, color: '#34d399' },
  { min: 60, color: '#a3e635' },
  { min: 40, color: '#fbbf24' },
  { min: 0, color: '#fb7185' },
] as const;

export const nodeColor = (node: MapNode): string => {
  if (node.trs === null) return STATUS_COLORS[node.statusClass];
  return (TRS_BANDS.find((band) => node.trs! >= band.min) ?? TRS_BANDS[3]).color;
};

export const statusColor = (statusClass: MapNode['statusClass']): string => STATUS_COLORS[statusClass];

/** Node diameter grows with the square root of inbound links, capped to keep big hubs readable. */
export const nodeSize = (inlinks: number): number => Math.round(Math.min(10 + Math.sqrt(Math.max(inlinks, 0)) * 5, 46));
