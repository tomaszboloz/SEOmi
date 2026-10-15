import type { CrawledPageSummary } from '@/types';

/** Site Focus Score engine contracts. All user-visible wording is a code plus params: the UI localizes. */

export const SITE_FOCUS_VERSION = 1;

export interface FocusTerm { term: string; surface: string; count: number; weight: number }
export interface HeadingTexts { h1: string[]; h2: string[]; h3: string[] }
/** Structural extension: the crawler adds these optional fields; old runs lack them. */
export type FocusPage = CrawledPageSummary & { focus_terms?: FocusTerm[]; heading_texts?: HeadingTexts };

export type PageType = 'homepage' | 'category' | 'article' | 'technical';
export type PageStatus = 'strong' | 'moderate' | 'borderline' | 'weak' | 'off-topic';
export type PagePriority = 'critical' | 'high' | 'medium' | 'low';
export type Playbook = 'A' | 'B' | 'C';
export type SfsBand = 'excellent' | 'good' | 'moderate' | 'weak' | 'critical';
export type FallbackMode = 'semantic' | 'lexical';
export type AlignmentLevel = 'strong' | 'moderate' | 'weak';
export type SkipReason = 'render-timeout' | 'request-error' | 'non-topical-status' | 'non-html' | 'no-content';
export type CodeParams = Record<string, number | string>;

export interface Coded { code: string; params: CodeParams }

/** Every code the engine can emit. The UI must provide a translation for each. */
export const SITE_FOCUS_CODES = {
  band: ['excellent', 'good', 'moderate', 'weak', 'critical'],
  skip: ['render-timeout', 'request-error', 'non-topical-status', 'non-html', 'no-content'],
  recommendation: [
    'remove-offtopic', 'strengthen-borderline', 'expand-core-cluster', 'add-internal-links',
    'collect-more-pages', 'split-subsites', 'review-skipped-pages', 'monitor-strong-pages',
  ],
  playbookOption: ['remove-redirect', 'noindex-isolate', 'rewrite-on-topic', 'add-missing-terms', 'reinforce-headings', 'deepen-coverage', 'serve-as-hub', 'build-satellite-cluster', 'monitor-periodically'],
  playbookStep: [
    'check-traffic-and-backlinks', 'redirect-301-to-closest-page', 'remove-internal-links', 'add-noindex', 'rewrite-with-brief',
    'add-terms', 'expand-h2-h3', 'add-examples', 'link-from-weak-pages', 'plan-satellite-pages', 'recheck-in-six-weeks',
  ],
  gap: ['thin-subtopic', 'competitor-terms'],
  link: ['link-to-hub'],
  history: ['removed-offtopic', 'new-cluster', 'optimized-borderline', 'core-topic-changed'],
  alert: ['sfs-drop', 'content-guard'],
} as const;
