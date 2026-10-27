import type { TFunction } from 'i18next';
import type { Coded, IgosBand, SectionZone } from '@/services/informationGain';

export const BAND_BAR: Record<IgosBand, string> = { original: 'bg-emerald-500', good: 'bg-lime-400', average: 'bg-amber-400', derivative: 'bg-orange-500', echo: 'bg-rose-500' };
export const BAND_TEXT: Record<IgosBand, string> = { original: 'text-emerald-300', good: 'text-lime-300', average: 'text-amber-300', derivative: 'text-orange-300', echo: 'text-rose-300' };
export const ZONE_BAR: Record<SectionZone, string> = { echo: 'bg-slate-500', gain: 'bg-emerald-500', drift: 'bg-rose-500' };
export const ZONE_TEXT: Record<SectionZone, string> = { echo: 'text-slate-300', gain: 'text-emerald-300', drift: 'text-rose-300' };
export const ZONES: SectionZone[] = ['gain', 'echo', 'drift'];

export const FOCUS_RING = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400';

/** Page-level text of an engine code; unknown codes fall back to the code itself. */
export const pageRec = (t: TFunction, item: Coded): string => t(`infoGain.rec.${item.code}`, { ...item.params, defaultValue: item.code });
export const siteRec = (t: TFunction, item: Coded): string => t(`infoGain.siteRec.${item.code}`, { ...item.params, defaultValue: item.code });
