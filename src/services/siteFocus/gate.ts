import { exclusionOf } from '@/services/indexabilityGate';
import type { Prepared } from './evaluate';

/** Marks noindex and canonicalized pages as skipped before scoring (#132); includeNonIndexable opts back in. */
export const applyIndexabilityGate = (items: Prepared[], includeNonIndexable = false): Prepared[] =>
  includeNonIndexable ? items : items.map((item) => {
    const reason = item.skipped ? undefined : exclusionOf(item.page);
    return reason ? { ...item, skipped: reason } : item;
  });

/** Pages excluded by the gate, for the "skipped N pages (noindex/canonical)" counter. */
export const gateSkippedCount = (pages: ReadonlyArray<{ skipped?: string }>): number =>
  pages.filter((page) => page.skipped === 'noindex' || page.skipped === 'canonicalized').length;
