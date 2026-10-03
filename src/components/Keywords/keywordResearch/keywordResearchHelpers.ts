import type { SearchIntent } from '@/types';
import type { TFunction } from 'i18next';

export const getIntentBadge = (intent: SearchIntent): string => {
  switch (intent) {
    case 'Informational':
      return 'bg-blue-500/10 text-blue-400 border-blue-500/30';
    case 'Commercial':
      return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
    case 'Transactional':
      return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
    case 'Navigational':
      return 'bg-purple-500/10 text-purple-400 border-purple-500/30';
  }
};

export const getDifficultyColor = (diff: number): string => {
  if (diff < 30) return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30';
  if (diff < 60) return 'text-amber-400 bg-amber-500/10 border-amber-500/30';
  return 'text-rose-400 bg-rose-500/10 border-rose-500/30';
};

export const intentLabel = (
  intent: SearchIntent | string,
  t: TFunction,
): string => t(`keywordResearchUi.intent.${intent.toLowerCase()}`);
