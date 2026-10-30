import { classify } from './classify';
import type { PageFeatures } from './types';

export type FormatKind = 'table' | 'ordered-list' | 'calculator' | 'product-cards' | 'cta';

export const FORMAT_GAP_PROFILE = { minShare: 0.6, minPages: 3 } as const;

const PRESENT: Record<FormatKind, (f: PageFeatures) => boolean> = {
  table: (f) => f.tables > 0,
  'ordered-list': (f) => f.orderedLists > 0,
  // GEM-69-09: a calculator counts only with function evidence (working controls) and intent evidence
  // (the page itself classifies as a tool), never from a class name or an input tag alone.
  calculator: (f) => (f.functionalCalculators ?? f.calculators) > 0 && f.formInputs > 0 && toolIntent(f),
  'product-cards': (f) => f.productCards > 0,
  cta: (f) => (f.ctas ?? 0) > 0,
};

const toolIntent = (f: PageFeatures): boolean => {
  const observed = classify(f);
  return observed.primary === 'tool' || observed.mixed.includes('tool');
};

/** A format whose presence on the analysed page is unknown is never reported as missing. */
const KNOWN: Partial<Record<FormatKind, (f: PageFeatures) => boolean>> = { cta: (f) => f.ctas !== undefined };

export interface FormatGap { format: FormatKind; topPages: number; analysed: number }

/** Formats that most rendered TOP pages use and the page lacks; nothing is suggested from fewer than 3 pages. */
export const formatGaps = (page: PageFeatures, top: readonly PageFeatures[]): FormatGap[] => {
  if (top.length < FORMAT_GAP_PROFILE.minPages) return [];
  return (Object.keys(PRESENT) as FormatKind[]).flatMap((format) => {
    const has = PRESENT[format];
    const topPages = top.filter(has).length;
    if (KNOWN[format] && !KNOWN[format]!(page)) return [];
    return !has(page) && topPages / top.length >= FORMAT_GAP_PROFILE.minShare ? [{ format, topPages, analysed: top.length }] : [];
  });
};
