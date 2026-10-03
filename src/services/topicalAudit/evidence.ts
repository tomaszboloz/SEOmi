import type { CrawledPageSummary } from '@/types';
import type { SemanticAuditFinding } from './types';
import i18n from '@/i18n';
import { normalizeSemanticText } from '@/services/semanticText';

export const MAX_FINDINGS = 500;
export const MAX_PAGES = 5000;
export const MAX_TERMS_PER_PAGE = 40;
export const MAX_PAGE_COMPARISONS = 250_000;
export const semanticText = (key: string, variables?: Record<string, unknown>): string => i18n.t(`runtimeErrors.semanticAudit.${key}`, variables);
type SemanticAuditFindingCode = SemanticAuditFinding['code'];
const nextStepKey: Record<SemanticAuditFindingCode, string> = {
  'unmapped-topic': 'actionUnmapped',
  'unassigned-page': 'actionUnassigned',
  'stale-url-assignment': 'actionStale',
  'ambiguous-page': 'actionAmbiguous',
  'query-not-observed': 'actionQuery',
  'topic-not-observed': 'actionTopic',
  'lifecycle-review': 'actionLifecycle',
  'topic-url-unhealthy': 'actionUnhealthy',
  'entity-not-observed': 'actionEntity',
  'possible-url-overlap': 'actionOverlap',
  'near-duplicate-content': 'actionDuplicate',
  'content-orphan-page': 'actionOrphan',
  'content-evidence-partial': 'actionContentEvidence',
  'query-intent-mismatch': 'actionIntent',
};
export const nextStep = (code: SemanticAuditFindingCode): string => semanticText(nextStepKey[code]);
const normalize = normalizeSemanticText;
export const tokens = (value: string) => normalize(value).split(/[^\p{L}\p{N}]+/u).filter((token) => token.length > 2);
export const termsFor = (page: CrawledPageSummary) => new Set((page.semantic_terms ?? []).slice(0, MAX_TERMS_PER_PAGE).map(normalize).filter(Boolean));
export const urlKey = (value: string | null | undefined, base?: string) => {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  if (!trimmed) return '';
  try {
    const url = new URL(trimmed, base);
    if (!['http:', 'https:'].includes(url.protocol)) return trimmed;
    url.hash = '';
    url.hostname = url.hostname.toLowerCase();
    // The URL constructor already removes each protocol's default port.
    if (url.pathname.length > 1) url.pathname = url.pathname.replace(/\/+$/u, '');
    return url.toString();
  } catch { return trimmed; }
};
export const termCoverage = (query: string, page: CrawledPageSummary) => {
  const expected = [...new Set(tokens(query))];
  if (!expected.length) return null;
  const observed = termsFor(page);
  return { expected, matched: expected.filter((term) => observed.has(term)) };
};

export const normalizedProviderIntent = (value: string | null | undefined): string | null => {
  const normalized = normalize(value ?? '').replace(/[\s_-]+/gu, '');
  if (normalized === 'informational') return 'informational';
  if (normalized === 'commercial' || normalized === 'commercialinvestigation') return 'commercial';
  if (normalized === 'transactional') return 'transactional';
  if (normalized === 'navigational' || normalized === 'navigation') return 'navigational';
  return null;
};

export const hammingDistance = (left: string, right: string): number | null => {
  if (!/^[a-f\d]{16}$/i.test(left) || !/^[a-f\d]{16}$/i.test(right)) return null;
  let bits = BigInt(`0x${left}`) ^ BigInt(`0x${right}`);
  let count = 0;
  while (bits) { count += Number(bits & 1n); bits >>= 1n; }
  return count;
};

export const addFinding = (findings: SemanticAuditFinding[], finding: Omit<SemanticAuditFinding, 'action'>) => {
  if (findings.length < MAX_FINDINGS) findings.push({ ...finding, action: nextStep(finding.code) });
};
