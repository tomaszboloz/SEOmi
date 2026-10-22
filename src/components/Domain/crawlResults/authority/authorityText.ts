import type { TFunction } from 'i18next';

export const GOAL = 80;

export const pct = (value: number): string => `${Math.round(value * 10) / 10}`;

/** Colour of a 0-100 score on the same bands as the Site Focus Score. */
export const toneFor = (value: number | null): string => {
  if (value === null) return 'text-slate-500';
  if (value >= 90) return 'text-emerald-300';
  if (value >= 75) return 'text-lime-300';
  if (value >= 60) return 'text-amber-300';
  if (value >= 40) return 'text-orange-300';
  return 'text-rose-300';
};

export const barFor = (value: number | null): string => {
  if (value === null) return 'bg-slate-700';
  if (value >= 90) return 'bg-emerald-500';
  if (value >= 75) return 'bg-lime-400';
  if (value >= 60) return 'bg-amber-400';
  if (value >= 40) return 'bg-orange-500';
  return 'bg-rose-500';
};

/** The catch-all pillar has no market name of its own. */
export const pillarName = (t: TFunction, id: string, label: string): string => (id === 'general' ? t('authority.coverage.general') : label);

export const host = (url: string): string => {
  try { const parsed = new URL(url); return `${parsed.pathname}${parsed.search}` || '/'; } catch { return url; }
};
