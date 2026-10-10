import type { PageAuditData } from '@/types';
import type { ContentGapTopic, InspectPage, SuppliedTargetEvidence, SuppliedTopTenEvidence, TopTenContentGapReport, TopTenPageObservation, TopTenSerpRow } from './types';
import { normalizeSerpUrl, selectOrganicTopTen } from './serp';

const MAX_TOPIC_TEXT = 50_000;
const MAX_TOPIC_TOKENS = 4_000;
const STOP_WORDS = new Set('a an and are as at be by for from in is it of on or the this to with oraz i w z na do dla że jak jest nie się o od pod nad po za'.split(' '));
const tokenList = (text: string): string[] => (text.slice(0, MAX_TOPIC_TEXT).toLocaleLowerCase().match(/[\p{L}\p{N}][\p{L}\p{N}'’-]{2,}/gu) ?? []).filter((token) => !STOP_WORDS.has(token)).slice(0, MAX_TOPIC_TOKENS);
const excerpt = (text: string, term: string): string => {
  const bounded = text.slice(0, MAX_TOPIC_TEXT);
  const at = bounded.toLocaleLowerCase().indexOf(term);
  return `${at > 60 ? '…' : ''}${bounded.slice(Math.max(0, at - 60), Math.min(bounded.length, at + term.length + 100))}${at + term.length + 100 < bounded.length ? '…' : ''}`;
};
const auditText = (audit: PageAuditData): string => [
  audit.meta_tags?.title ?? '',
  ...(audit.headings?.h1_texts ?? []),
  audit.content_stats?.body_text ?? '',
].filter(Boolean).join(' ');

const buildTopics = (pages: Array<{ rank: number; url: string; text: string }>, availablePages: number, targetCounts: Map<string, number> | null): ContentGapTopic[] => {
  if (!availablePages) return [];
  const perPage = pages.map((page) => {
    const counts = new Map<string, number>();
    tokenList(page.text).forEach((term) => counts.set(term, (counts.get(term) ?? 0) + 1));
    return { ...page, counts };
  });
  const counts = new Map<string, { pages: number; total: number; evidence: Array<{ rank: number; url: string; excerpt: string }> }>();
  perPage.forEach((page) => page.counts.forEach((total, term) => {
    const current = counts.get(term) || { pages: 0, total: 0, evidence: [] };
    current.pages += 1;
    current.total += total;
    if (current.evidence.length < 4) current.evidence.push({ rank: page.rank, url: page.url, excerpt: excerpt(page.text, term) });
    counts.set(term, current);
  }));
  return [...counts.entries()].sort((left, right) => right[1].pages - left[1].pages || right[1].total - left[1].total || left[0].localeCompare(right[0])).slice(0, 30).map(([term, value]) => {
    const share = value.pages / availablePages;
    const targetOccurrences = targetCounts ? (targetCounts.get(term) ?? 0) : null;
    const targetPresent = targetCounts ? targetOccurrences! > 0 : null;
    return { term, observedPages: value.pages, availablePages, share, targetOccurrences, targetPresent, status: targetCounts ? (targetPresent ? 'covered' : 'gap') : 'unknown', evidence: value.evidence };
  });
};

const errorText = (error: unknown): string => (error instanceof Error ? error.message : String(error)).slice(0, 240);
const hasAuditIdentity = (audit: PageAuditData | null): audit is PageAuditData => Boolean(audit && (audit.url || audit.final_url));
const MISMATCHED_EVIDENCE = 'Inspected page evidence does not match the requested SERP URL';
const matchesRequestedUrl = (requestedUrl: string, audit: PageAuditData): boolean => {
  const requested = normalizeSerpUrl(requestedUrl);
  if (!requested) return false;
  const original = typeof audit.url === 'string' && audit.url.trim() ? normalizeSerpUrl(audit.url) : null;
  if (original) return original === requested;
  return typeof audit.final_url === 'string' && normalizeSerpUrl(audit.final_url) === requested;
};

const observation = (row: TopTenSerpRow, fetchedAt: string | null, audit?: PageAuditData, error?: unknown): TopTenPageObservation => {
  const status = typeof audit?.http_status === 'number' && Number.isFinite(audit.http_status) ? audit.http_status : null;
  const finalUrl = audit && audit.final_url ? audit.final_url : normalizeSerpUrl(row.url as string);
  const hasBody = Boolean(audit?.content_stats?.body_text?.trim());
  const goodStatus = status === null || (status >= 200 && status < 400);
  return {
    rank: row.rank as number,
    url: row.url as string,
    providerTitle: row.title ?? '',
    providerDescription: row.description ?? '',
    fetchedAt,
    status,
    finalUrl,
    availability: error ? 'error' : goodStatus && hasBody ? 'available' : 'unavailable',
    error: error ? errorText(error) : goodStatus && hasBody ? null : status && status >= 400 ? `http-${status}` : 'body-unavailable',
  };
};

export interface ContentGapOptions {
  phrase: string;
  rows: readonly TopTenSerpRow[];
  inspectUrl: InspectPage;
  locationCode?: number | null;
  languageCode?: string | null;
  retrievedAt?: string;
  now?: () => string;
  concurrency?: number;
  targetPageAudit?: PageAuditData | null;
  targetEvidence?: SuppliedTargetEvidence | null;
}

export interface BuildContentGapOptions {
  phrase: string;
  rows: readonly TopTenSerpRow[];
  evidence: readonly SuppliedTopTenEvidence[];
  locationCode?: number | null;
  languageCode?: string | null;
  retrievedAt?: string;
  now?: () => string;
  targetPageAudit?: PageAuditData | null;
  targetEvidence?: SuppliedTargetEvidence | null;
}

const reportFromEvidence = (options: BuildContentGapOptions, selected: TopTenSerpRow[], evidence: readonly SuppliedTopTenEvidence[], now: () => string): TopTenContentGapReport => {
  const byUrl = new Map(evidence.map((item) => [normalizeSerpUrl(item.url)!, item]));
  const audits: Array<PageAuditData | undefined> = [];
  const rows = selected.map((row, index) => {
    const supplied = byUrl.get(normalizeSerpUrl(row.url as string)!);
    const mismatch = supplied?.audit && !matchesRequestedUrl(row.url as string, supplied.audit);
    const evidenceError = supplied?.error ?? (mismatch ? MISMATCHED_EVIDENCE : supplied ? undefined : 'missing-evidence');
    audits[index] = evidenceError ? undefined : supplied?.audit;
    return observation(row, supplied ? supplied.fetchedAt : null, audits[index], evidenceError);
  });
  const available = rows.filter((row) => row.availability === 'available').length;
  const targetAudit = options.targetEvidence?.audit ?? options.targetPageAudit ?? null;
  const targetAvailable = hasAuditIdentity(targetAudit);
  const targetCounts = targetAvailable ? new Map<string, number>() : null;
  if (targetAvailable && targetAudit) tokenList(auditText(targetAudit)).forEach((term) => targetCounts!.set(term, (targetCounts!.get(term) ?? 0) + 1));
  const topicPages = rows.flatMap((row, index) => row.availability === 'available' && audits[index]
    ? [{ rank: row.rank, url: row.url, text: auditText(audits[index]!) }]
    : []);
  const status = !selected.length || !available ? 'unavailable' : available === selected.length ? 'complete' : 'partial';
  return { phrase: options.phrase.trim(), source: 'supplied-serp', retrievedAt: options.retrievedAt || now(), locationCode: options.locationCode ?? null, languageCode: options.languageCode ?? null, rows, availablePages: available, targetAvailable, status, topics: buildTopics(topicPages, available, targetCounts) };
};

/** Builds a report from explicitly supplied SERP rows and page evidence only. */
export const buildTopTenContentGap = (options: BuildContentGapOptions): TopTenContentGapReport => {
  const now = options.now || (() => new Date().toISOString());
  return reportFromEvidence(options, selectOrganicTopTen(options.rows), options.evidence, now);
};

/** Fetches only supplied organic rows; it never discovers or fabricates SERP results. */
export const collectTopTenContentGap = async (options: ContentGapOptions): Promise<TopTenContentGapReport> => {
  const now = options.now || (() => new Date().toISOString());
  const selected = selectOrganicTopTen(options.rows);
  const evidence: SuppliedTopTenEvidence[] = Array(selected.length);
  let cursor = 0;
  const worker = async () => {
    while (cursor < selected.length) {
      const index = cursor++;
      const row = selected[index];
      try {
        const audit = await options.inspectUrl(row.url as string);
        if (!matchesRequestedUrl(row.url as string, audit)) throw new Error(MISMATCHED_EVIDENCE);
        evidence[index] = { url: row.url as string, fetchedAt: now(), audit };
        // Keep the callback's returned audit as the only content evidence.
      }
      catch (error) { evidence[index] = { url: row.url as string, fetchedAt: now(), error }; }
    }
  };
  const requestedConcurrency = options.concurrency ?? 2;
  const finiteConcurrency = Number.isFinite(requestedConcurrency) ? Math.floor(requestedConcurrency) : 2;
  const workerCount = Math.min(Math.max(1, finiteConcurrency), Math.max(1, selected.length));
  await Promise.all(Array.from({ length: workerCount }, worker));
  return reportFromEvidence({ ...options, evidence }, selected, evidence, now);
};
