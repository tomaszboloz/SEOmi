import type { AuditedSection } from './sections';
import { WEIGHTS, type Coded, type IgosParts } from './types';

export interface RecommendInput {
  parts: IgosParts;
  /** 0-1 component values the parts were rounded from. */
  raw: { nefr: number; edsi: number; fhem: number | null };
  multiplier: number;
  sections: AuditedSection[];
  missing: string[];
  novelCount: number;
  tables: number;
  avgTables: number;
}

const join = (items: string[], separator: string, limit: number): string => items.slice(0, limit).join(separator);

/** Estimated points if a component rose by `lift` (0-1); a planning aid, not a promise. */
export const gainOf = (weight: number, lift: number, multiplier: number): number => Math.max(1, Math.round(weight * lift * multiplier * 100));

export const pageRecommendations = (input: RecommendInput): Coded[] => {
  const { raw, multiplier, sections } = input;
  const out: Coded[] = [];
  const share = (zone: string): number => (sections.length ? sections.filter((item) => item.zone === zone).length / sections.length : 0);
  const echo = sections.filter((item) => item.zone === 'echo');
  if (share('echo') > 0.6) out.push({ code: 'rewrite-echo-sections', params: { count: echo.length, headings: join(echo.map((item) => item.heading || '—'), '; ', 2), gain: gainOf(WEIGHTS.nefr, 0.3, multiplier) } });
  if (raw.fhem !== null && raw.fhem < 0.5) out.push({ code: 'add-first-hand', params: { gain: gainOf(WEIGHTS.fhem, Math.min(1, raw.fhem + 0.34) - raw.fhem, multiplier) } });
  if (raw.edsi < 0.55 || input.tables < input.avgTables) {
    out.push({ code: 'add-data', params: { tables: input.tables, avgTables: Math.round(input.avgTables * 10) / 10, gain: gainOf(WEIGHTS.edsi, 0.25, multiplier) } });
  }
  if (raw.nefr < 0.5) out.push({ code: 'add-novel-entities', params: { count: input.novelCount, gain: gainOf(WEIGHTS.nefr, 0.2, multiplier) } });
  if (input.missing.length) out.push({ code: 'fill-consensus', params: { entities: join(input.missing, ', ', 5), gain: gainOf(WEIGHTS.nefr, 0.1, 1 + (1 - multiplier)) } });
  const drift = sections.filter((item) => item.zone === 'drift');
  if (drift.length) out.push({ code: 'remove-drift-sections', params: { count: drift.length, heading: drift[0].heading || '—' } });
  return out;
};
