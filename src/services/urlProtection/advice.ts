/**
 * Manual alternatives a protection decision may suggest, each with the conditions that must hold
 * before anyone acts on it. SEOmi never executes them: no 301, noindex or 410 is applied by a
 * recommendation, and none of them promises to recover the same number of visits.
 */
export type ProtectionAlternative =
  | 'confirm-revenue-currency'
  | 'check-gsc-ga4-backlinks-access'
  | 'link-to-pillar'
  | 'redirect-301-to-relevant-target'
  | 'canonical-for-duplicates'
  | 'keep-and-rewrite'
  | 'noindex-or-410-after-review';

export type AdviceCondition =
  | 'currency-from-analytics'
  | 'fresh-90-day-window'
  | 'real-topic-relation'
  | 'relevant-target-same-intent'
  | 'no-measured-value'
  | 'update-links-and-sitemap'
  | 'near-duplicate-only'
  | 'owner-confirms-value'
  | 'not-via-robots-txt'
  | 'business-review';

export interface ProtectionAdvice { code: ProtectionAlternative; conditions: AdviceCondition[] }

export const ADVICE_CONDITIONS: Record<ProtectionAlternative, AdviceCondition[]> = {
  'confirm-revenue-currency': ['currency-from-analytics'],
  'check-gsc-ga4-backlinks-access': ['fresh-90-day-window'],
  'link-to-pillar': ['real-topic-relation'],
  'redirect-301-to-relevant-target': ['relevant-target-same-intent', 'no-measured-value', 'update-links-and-sitemap'],
  'canonical-for-duplicates': ['near-duplicate-only'],
  'keep-and-rewrite': ['owner-confirms-value'],
  'noindex-or-410-after-review': ['no-measured-value', 'business-review', 'not-via-robots-txt'],
};

export const adviceFor = (alternatives: readonly ProtectionAlternative[]): ProtectionAdvice[] =>
  alternatives.map((code) => ({ code, conditions: ADVICE_CONDITIONS[code] }));
