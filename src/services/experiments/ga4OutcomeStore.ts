import { z } from 'zod';
import { readJsonStorage, writeJsonStorage } from '@/services/storage';

/**
 * Daily GA4 outcomes per intervention target (#97): key events and revenue of organic search sessions, for the
 * whole site (`site`) or one landing page. Saved per project; revenue stays in the currency GA4 reported.
 */
export const OUTCOMES = ['gsc-clicks', 'ga4-key-events', 'ga4-revenue'] as const;
export type Outcome = (typeof OUTCOMES)[number];
export const MAX_GA4_TARGETS = 12;

const entry = z.object({
  property: z.string().min(1), currency: z.string().regex(/^[A-Z]{3}$/u), fetchedAt: z.iso.datetime(),
  daily: z.array(z.object({ date: z.iso.date(), keyEvents: z.number().finite().nonnegative(), revenue: z.number().finite().nonnegative() })).max(1000),
});
export type Ga4Outcomes = z.infer<typeof entry>;
const store = z.record(z.string(), entry);
export const ga4OutcomeKey = (projectId: string): string => `seomi_project_${projectId}_ga4_daily_v1`;
export const outcomeChoiceKey = (projectId: string): string => `seomi_project_${projectId}_experiment_outcome_v1`;

export const loadGa4Outcomes = (projectId: string): Record<string, Ga4Outcomes> => {
  const parsed = store.safeParse(readJsonStorage(ga4OutcomeKey(projectId), {}));
  return parsed.success ? parsed.data : {};
};

export const saveGa4Outcomes = (projectId: string, target: string, series: Ga4Outcomes): boolean => {
  const all = { ...loadGa4Outcomes(projectId), [target]: series };
  const kept = Object.entries(all).sort(([, a], [, b]) => b.fetchedAt.localeCompare(a.fetchedAt)).slice(0, MAX_GA4_TARGETS);
  return writeJsonStorage(ga4OutcomeKey(projectId), Object.fromEntries(kept));
};

export const loadOutcomeChoice = (projectId: string): Outcome => {
  const raw = readJsonStorage(outcomeChoiceKey(projectId), 'gsc-clicks');
  return OUTCOMES.find((outcome) => outcome === raw) ?? 'gsc-clicks';
};

export const saveOutcomeChoice = (projectId: string, outcome: Outcome): boolean => writeJsonStorage(outcomeChoiceKey(projectId), outcome);
