import type { TrustLayer, TrustLevel, TrustSeverity } from '@/services/eeatTrust';
import type { HelpId } from '@/components/Help/helpTypes';

export const LEVEL_BAR: Record<TrustLevel, string> = { strong: 'bg-emerald-500', adequate: 'bg-amber-400', weak: 'bg-orange-500', critical: 'bg-rose-500' };
export const LEVEL_TEXT: Record<TrustLevel, string> = { strong: 'text-emerald-300', adequate: 'text-amber-300', weak: 'text-orange-300', critical: 'text-rose-300' };
export const SEVERITY_TEXT: Record<TrustSeverity, string> = { critical: 'text-rose-300', warning: 'text-amber-300', info: 'text-sky-300' };

export const LAYERS: Array<{ layer: TrustLayer; help: HelpId }> = [
  { layer: 'schemaGraph', help: 'trust.schemaGraph' },
  { layer: 'sameAs', help: 'trust.schemaGraph' },
  { layer: 'authorAlignment', help: 'trust.authorAlignment' },
  { layer: 'citationQuality', help: 'trust.citationQuality' },
  { layer: 'transparency', help: 'trust.transparency' },
];

export const levelOfScore = (score: number): TrustLevel => (score >= 75 ? 'strong' : score >= 60 ? 'adequate' : score >= 40 ? 'weak' : 'critical');

export const FOCUS_RING = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400';
