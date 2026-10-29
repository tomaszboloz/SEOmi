import type { PageFeatures } from './types';

export type FormatKind = 'table' | 'ordered-list' | 'calculator' | 'product-cards';

export const FORMAT_GAP_PROFILE = { minShare: 0.6, minPages: 3 } as const;

const PRESENT: Record<FormatKind, (f: PageFeatures) => boolean> = {
  table: (f) => f.tables > 0,
  'ordered-list': (f) => f.orderedLists > 0,
  // A calculator needs a real form control inside it (GEM-69-09), not just a class name.
  calculator: (f) => f.calculators > 0 && f.formInputs > 0,
  'product-cards': (f) => f.productCards > 0,
};

export interface FormatGap { format: FormatKind; topPages: number; analysed: number }

/** Formats that most rendered TOP pages use and the page lacks; nothing is suggested from fewer than 3 pages. */
export const formatGaps = (page: PageFeatures, top: readonly PageFeatures[]): FormatGap[] => {
  if (top.length < FORMAT_GAP_PROFILE.minPages) return [];
  return (Object.keys(PRESENT) as FormatKind[]).flatMap((format) => {
    const has = PRESENT[format];
    const topPages = top.filter(has).length;
    return !has(page) && topPages / top.length >= FORMAT_GAP_PROFILE.minShare ? [{ format, topPages, analysed: top.length }] : [];
  });
};
