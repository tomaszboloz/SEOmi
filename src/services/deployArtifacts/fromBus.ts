import type { QuarantineEntry } from '@/services/recommendationBus';
import type { RedirectRule } from './types';

/** Quarantine entries become rules: remove -> 410, redirect -> 301 to the canonical URL. */
export const rulesFromQuarantine = (quarantine: QuarantineEntry[]): RedirectRule[] =>
  quarantine.flatMap((entry): RedirectRule[] => {
    if (entry.reason === 'remove') return [{ from: entry.url, to: null, status: 410 }];
    return entry.target ? [{ from: entry.url, to: entry.target, status: 301 }] : [];
  });
